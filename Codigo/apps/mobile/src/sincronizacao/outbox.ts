import type { Database } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type {
  CheckinRequest,
  CheckoutRequest,
  JornadaDTO,
  SolicitarPontoEmAtrasoRequest,
} from '@montacontrol/shared';
import { enviarAtestado } from '../atestados/clienteAtestados';
import { enviarAvaria } from '../avarias/clienteAvarias';
import { enviarConferencia } from '../conferencia/clienteConferencia';
import type { PayloadConferenciaNaFila } from '../conferencia/conferencia';
import { AcaoPendente } from '../db/AcaoPendente';
import { ErroApi } from '../http/erroApi';
import { enviarCheckin, enviarCheckout, enviarSolicitacaoPonto } from '../jornada/clienteJornadas';
import { lerJornadasComPendentes } from '../jornada/jornadasComPendentes';
import {
  apagarFotosDaAcao,
  caminhosDasFotos,
  MENSAGEM_ATESTADO_SEM_FOTOS,
  CODIGO_ATESTADO_SEM_FOTOS,
  montarCorpoAtestado,
  montarCorpoAvaria,
} from './payloadsDaFila';
import type { PayloadAtestadoNaFila, PayloadAvariaNaFila } from './payloadsDaFila';

export type ResultadoEnvio<T> = { tipo: 'ok'; dado: T } | { tipo: 'recusado'; codigo: string };
export type ResultadoPontoEmAtraso = { tipo: 'ok' } | { tipo: 'recusado'; codigo: string };
/** `pendente`: sem rede agora, fica na fila e sobe sozinho quando a conexão voltar. */
export type ResultadoAvaria =
  | { tipo: 'enviada' }
  | { tipo: 'pendente' }
  | { tipo: 'recusado'; codigo: string; mensagem: string };
/** Leitura de código de barras: a regra já rodou no aparelho; o envio só confirma. */
export type ResultadoConferencia =
  | { tipo: 'enviada' }
  | { tipo: 'pendente' }
  | { tipo: 'recusado'; codigo: string; mensagem: string };
/** Mesma ideia da avaria: `pendente` = sem rede agora, sobe sozinho depois. */
export type ResultadoAtestado =
  | { tipo: 'enviado' }
  | { tipo: 'pendente' }
  | { tipo: 'recusado'; codigo: string; mensagem: string };

/**
 * Só 4xx de **regra de negócio** (400, 403, 404, 409, 422…) é recusa: o
 * servidor avaliou a ação e disse não, retentar não muda nada. Fora disso a
 * ação continua na fila:
 * - 401: o token expirou (dura 1h; o montador pode ficar horas sem sinal) —
 *   a sessão é renovada e a ação sobe depois, nunca é apagada por isso;
 * - 408/429: o servidor nem chegou a decidir (timeout / limite de taxa).
 */
export function ehRecusaDoServidor(erro: unknown): erro is ErroApi {
  return (
    erro instanceof ErroApi &&
    erro.status >= 400 &&
    erro.status < 500 &&
    ![401, 408, 429].includes(erro.status)
  );
}

async function enfileirar(
  database: Database,
  tipo: string,
  idCliente: string,
  payload: unknown,
): Promise<AcaoPendente> {
  const colecao = database.get<AcaoPendente>('acoes_pendentes');
  return database.write(() =>
    colecao.create((registro) => {
      registro.tipo = tipo;
      registro.idCliente = idCliente;
      registro.payload = JSON.stringify(payload);
      registro.criadoEm = new Date().toISOString();
      registro.status = 'pendente';
      registro.mensagemDescarte = null;
    }),
  );
}

/** O enfileiramento em si falhou: nenhuma linha existe (e as fotos já foram apagadas). */
export class ErroAoEnfileirar extends Error {
  constructor(causa: unknown) {
    super(causa instanceof Error ? causa.message : 'Falha ao enfileirar a ação.');
    this.name = 'ErroAoEnfileirar';
  }
}

/**
 * Enfileira uma ação que carrega fotos em arquivo. Quem chama entrega as fotos
 * à fila ao chamar: a partir daqui o formulário não é mais dono delas. Se o
 * enfileiramento falha nenhuma linha as referencia, então os arquivos são
 * apagados aqui mesmo (e `ErroAoEnfileirar` sobe); depois de a linha existir, só a
 * confirmação ou a recusa do servidor (ou o logout) as apaga.
 */
async function enfileirarComFotos(
  database: Database,
  tipo: 'avaria' | 'atestado',
  payload: PayloadAvariaNaFila | PayloadAtestadoNaFila,
): Promise<AcaoPendente> {
  try {
    return await enfileirar(database, tipo, payload.idCliente, payload);
  } catch (erro) {
    await apagarFotosDaAcao(caminhosDasFotos(payload));
    throw new ErroAoEnfileirar(erro);
  }
}

/**
 * Marca como `enviada` e solta as fotos. Se a marcação falhar, a linha segue
 * `pendente` — e dona das fotos: o reenvio é idempotente por `idCliente` —,
 * então isso não é erro para a tela; devolve `false` (ela mostra "na fila").
 */
async function confirmarEnvio(
  database: Database,
  acao: AcaoPendente,
  caminhos: readonly string[],
): Promise<boolean> {
  try {
    await marcarComoEnviada(database, acao);
  } catch {
    return false;
  }
  await apagarFotosDaAcao(caminhos);
  return true;
}

/**
 * Aceita pelo servidor, a ação fica `enviada` até o pull trazer o registro
 * (ver `StatusAcao`): a lista continua mostrando o item nesse intervalo e, se
 * o pull falhar logo depois do envio, o montador não o vê sumir e reenvia.
 */
async function marcarComoEnviada(database: Database, acao: AcaoPendente): Promise<void> {
  await database.write(() =>
    acao.update((registro) => {
      registro.status = 'enviada';
    }),
  );
}

/**
 * A jornada que a tela mostra para a ação recém-enfileirada: a da sobreposição
 * (réplica + fila), achada pelo `idCliente`. Um check-out sem jornada aberta
 * conhecida não aparece na sobreposição; devolve só o que se sabe dele.
 */
async function jornadaDaAcao(
  database: Database,
  tipo: 'checkin' | 'checkout',
  payload: CheckinRequest | CheckoutRequest,
): Promise<JornadaDTO> {
  const exibidas = await lerJornadasComPendentes(database);
  const achada = exibidas.find((jornada) =>
    tipo === 'checkin'
      ? jornada.checkinIdCliente === payload.idCliente
      : jornada.checkoutIdCliente === payload.idCliente,
  );
  if (achada) return achada;

  return {
    id: -1,
    usuarioId: -1,
    status: StatusJornada.FINALIZADA,
    checkinAt: null,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: payload.registradoEm,
    checkoutLatitude: payload.latitude,
    checkoutLongitude: payload.longitude,
    checkoutEndereco: payload.endereco ?? null,
    lancadoEmAtraso: false,
    criadoEm: payload.registradoEm,
  };
}

/**
 * Check-in ou check-out: entra na fila antes de tentar a rede — nunca perde a
 * marcação — e a tela a mostra pela sobreposição (a réplica só é escrita pelo
 * `synchronize()`).
 *
 * Aceito de imediato, a ação fica `enviada` até o pull trazer a jornada (ver
 * `StatusAcao`). Sem rede ou com 401 ela segue `pendente` e a drenagem em
 * segundo plano tenta de novo, já com a sessão renovada. Recusa de regra (4xx)
 * apaga a ação, e a marcação some da tela junto.
 */
export async function executarAcaoJornada(
  database: Database,
  tipo: 'checkin' | 'checkout',
  payload: CheckinRequest | CheckoutRequest,
): Promise<ResultadoEnvio<JornadaDTO>> {
  const acao = await enfileirar(database, tipo, payload.idCliente, payload);

  try {
    const jornadaServidor =
      tipo === 'checkin'
        ? await enviarCheckin(payload as CheckinRequest)
        : await enviarCheckout(payload as CheckoutRequest);

    await marcarComoEnviada(database, acao);
    return { tipo: 'ok', dado: jornadaServidor };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      await database.write(() => acao.destroyPermanently());
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    return { tipo: 'ok', dado: await jornadaDaAcao(database, tipo, payload) };
  }
}

/** Ponto em atraso: mesma fila, sem sobreposição (a tela já mostra "enviada" incondicionalmente). */
export async function executarAcaoPontoEmAtraso(
  database: Database,
  payload: SolicitarPontoEmAtrasoRequest,
): Promise<ResultadoPontoEmAtraso> {
  const acao = await enfileirar(database, 'ponto_em_atraso', payload.idCliente, payload);

  try {
    await enviarSolicitacaoPonto(payload);
    await database.write(() => acao.destroyPermanently());
    return { tipo: 'ok' };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      await database.write(() => acao.destroyPermanently());
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    return { tipo: 'ok' };
  }
}

/**
 * Reporte de avaria: o montador está na casa do cliente, muitas vezes sem
 * sinal — o reporte entra na fila antes da rede e nunca se perde. As fotos já
 * são arquivos no aparelho (o payload leva só as referências, e **passam a ser
 * da fila no instante da chamada**: quem chama as solta do formulário antes de
 * esperar a rede); viram base64 aqui,
 * no envio, e os arquivos somem quando o servidor confirma ou recusa. Recusa
 * do servidor (4xx) sai da fila e volta para a tela com a mensagem.
 */
export async function executarAcaoAvaria(
  database: Database,
  payload: PayloadAvariaNaFila,
): Promise<ResultadoAvaria> {
  const acao = await enfileirarComFotos(database, 'avaria', payload);

  try {
    await enviarAvaria(await montarCorpoAvaria(payload));
  } catch (erro) {
    if (!ehRecusaDoServidor(erro)) return { tipo: 'pendente' };
    await database.write(() => acao.destroyPermanently());
    await apagarFotosDaAcao(caminhosDasFotos(payload));
    return { tipo: 'recusado', codigo: erro.codigo, mensagem: erro.message };
  }
  return (await confirmarEnvio(database, acao, caminhosDasFotos(payload)))
    ? { tipo: 'enviada' }
    : { tipo: 'pendente' };
}

/**
 * Bipagem no descarregamento (US02): a leitura entra na fila antes da rede —
 * o checklist a mostra conferida pela sobreposição, com ou sem sinal (N4T3).
 * Aceita, fica `enviada` até o pull trazer a peça DESCARREGADA. Recusa (o
 * montador deixou de estar no pedido) sai da fila e volta com a mensagem.
 */
export async function executarAcaoConferencia(
  database: Database,
  payload: PayloadConferenciaNaFila,
): Promise<ResultadoConferencia> {
  const acao = await enfileirar(database, 'conferencia', payload.idCliente, payload);

  try {
    await enviarConferencia(payload);
  } catch (erro) {
    if (!ehRecusaDoServidor(erro)) return { tipo: 'pendente' };
    await database.write(() => acao.destroyPermanently());
    return { tipo: 'recusado', codigo: erro.codigo, mensagem: erro.message };
  }
  try {
    await marcarComoEnviada(database, acao);
  } catch {
    // Segue `pendente` e sobe de novo na drenagem — a API é idempotente.
    return { tipo: 'pendente' };
  }
  return { tipo: 'enviada' };
}

/**
 * Atestado: mesmo caminho da avaria (fila antes da rede, fotos em arquivo,
 * idempotente por `idCliente` no servidor). Sem nenhuma foto legível o envio
 * seria recusado — atestado sem documento não é analisável —, então nem vai.
 */
export async function executarAcaoAtestado(
  database: Database,
  payload: PayloadAtestadoNaFila,
): Promise<ResultadoAtestado> {
  const acao = await enfileirarComFotos(database, 'atestado', payload);

  try {
    const corpo = await montarCorpoAtestado(payload);
    if (corpo === null) {
      await database.write(() => acao.destroyPermanently());
      return {
        tipo: 'recusado',
        codigo: CODIGO_ATESTADO_SEM_FOTOS,
        mensagem: MENSAGEM_ATESTADO_SEM_FOTOS,
      };
    }
    await enviarAtestado(corpo);
  } catch (erro) {
    if (!ehRecusaDoServidor(erro)) return { tipo: 'pendente' };
    await database.write(() => acao.destroyPermanently());
    await apagarFotosDaAcao(caminhosDasFotos(payload));
    return { tipo: 'recusado', codigo: erro.codigo, mensagem: erro.message };
  }
  return (await confirmarEnvio(database, acao, caminhosDasFotos(payload)))
    ? { tipo: 'enviado' }
    : { tipo: 'pendente' };
}
