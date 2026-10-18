import type { Database } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type {
  CheckinRequest,
  CheckoutRequest,
  JornadaDTO,
  ReportarAvariaRequest,
  SolicitarPontoEmAtrasoRequest,
} from '@montacontrol/shared';
import { enviarAvaria } from '../avarias/clienteAvarias';
import { AcaoPendente } from '../db/AcaoPendente';
import { ErroApi } from '../http/erroApi';
import { enviarCheckin, enviarCheckout, enviarSolicitacaoPonto } from '../jornada/clienteJornadas';
import { lerJornadasComPendentes } from '../jornada/jornadasComPendentes';

export type ResultadoEnvio<T> = { tipo: 'ok'; dado: T } | { tipo: 'recusado'; codigo: string };
export type ResultadoPontoEmAtraso = { tipo: 'ok' } | { tipo: 'recusado'; codigo: string };
/** `pendente`: sem rede agora, fica na fila e sobe sozinho quando a conexão voltar. */
export type ResultadoAvaria =
  | { tipo: 'enviada' }
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

    await database.write(() =>
      acao.update((registro) => {
        registro.status = 'enviada';
      }),
    );
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
 * sinal — o reporte entra na fila antes da rede e nunca se perde. Recusa do
 * servidor (4xx) sai da fila e volta para a tela com a mensagem.
 */
export async function executarAcaoAvaria(
  database: Database,
  payload: ReportarAvariaRequest,
): Promise<ResultadoAvaria> {
  const acao = await enfileirar(database, 'avaria', payload.idCliente, payload);

  try {
    await enviarAvaria(payload);
    await database.write(() => acao.destroyPermanently());
    return { tipo: 'enviada' };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      await database.write(() => acao.destroyPermanently());
      return { tipo: 'recusado', codigo: erro.codigo, mensagem: erro.message };
    }
    return { tipo: 'pendente' };
  }
}
