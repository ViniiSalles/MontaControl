import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type { CheckinRequest, CheckoutRequest, JornadaDTO } from '@montacontrol/shared';
import { AcaoPendente } from '../db/AcaoPendente';
import type { StatusAcao } from '../db/AcaoPendente';
import { Jornada } from '../db/Jornada';

/**
 * Jornada como a tela mostra: a do servidor (réplica) ou a que ainda só existe
 * como ação na fila. Acrescenta ao DTO da API a obra e os UUIDs do aparelho —
 * os UUIDs são o que casa a ação da fila com a jornada que o pull trouxe.
 */
export interface JornadaExibida extends JornadaDTO {
  /** Obra do check-in; `null` em jornada antiga, ponto em atraso ou obra ilegível. */
  pedidoId: number | null;
  checkinIdCliente: string | null;
  checkoutIdCliente: string | null;
}

/** Check-in/check-out ainda na fila (ou já aceito e aguardando o pull), com o payload lido. */
export type AcaoDeJornada =
  | { tipo: 'checkin'; idCliente: string; payload: CheckinRequest; criadoEm: string }
  | { tipo: 'checkout'; idCliente: string; payload: CheckoutRequest; criadoEm: string };

/** Check-in/check-out ainda não resolvidos: `pendente` (a enviar) e `enviada` (aguardando o pull). */
const STATUS_NA_SOBREPOSICAO: StatusAcao[] = ['pendente', 'enviada'];

/**
 * Colunas da réplica que mudam in-place num `synchronize()` e precisam
 * reemitir a consulta (`observe()` sozinho só reage a entrada/saída de registro).
 */
export const COLUNAS_OBSERVADAS_DE_JORNADA = [
  'pedido_id',
  'status',
  'checkin_at',
  'checkin_latitude',
  'checkin_longitude',
  'checkin_endereco',
  'checkin_id_cliente',
  'checkout_at',
  'checkout_latitude',
  'checkout_longitude',
  'checkout_endereco',
  'checkout_id_cliente',
  'lancado_em_atraso',
];

function numeroOuNulo(valor: string | null): number | null {
  if (valor === null) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** Linha da réplica → jornada exibível. O id local é o do servidor (string numérica). */
export function paraJornadaExibida(registro: Jornada): JornadaExibida {
  return {
    id: Number(registro.id),
    usuarioId: registro.usuarioId,
    status: registro.status as StatusJornada,
    checkinAt: registro.checkinAt,
    checkinLatitude: registro.checkinLatitude,
    checkinLongitude: registro.checkinLongitude,
    checkinEndereco: registro.checkinEndereco,
    checkoutAt: registro.checkoutAt,
    checkoutLatitude: registro.checkoutLatitude,
    checkoutLongitude: registro.checkoutLongitude,
    checkoutEndereco: registro.checkoutEndereco,
    lancadoEmAtraso: registro.lancadoEmAtraso,
    criadoEm: registro.criadoEm,
    pedidoId: numeroOuNulo(registro.pedidoId),
    checkinIdCliente: registro.checkinIdCliente,
    checkoutIdCliente: registro.checkoutIdCliente,
  };
}

/** `null` para tipo que não é de jornada ou payload ilegível — a sobreposição só mostra o que entende. */
export function paraAcaoDeJornada(acao: AcaoPendente): AcaoDeJornada | null {
  if (acao.tipo !== 'checkin' && acao.tipo !== 'checkout') return null;
  try {
    const payload = JSON.parse(acao.payload) as CheckinRequest | CheckoutRequest;
    return { tipo: acao.tipo, idCliente: acao.idCliente, payload, criadoEm: acao.criadoEm } as AcaoDeJornada;
  } catch {
    return null;
  }
}

function indiceDaEmAndamentoMaisRecente(jornadas: readonly JornadaExibida[]): number {
  let indice = -1;
  jornadas.forEach((jornada, i) => {
    if (jornada.status !== StatusJornada.EM_ANDAMENTO || jornada.checkinAt === null) return;
    if (indice === -1 || jornada.checkinAt > (jornadas[indice].checkinAt ?? '')) indice = i;
  });
  return indice;
}

/**
 * Réplica + ações na fila por cima. A ação some da sobreposição assim que a
 * réplica tem a jornada com o mesmo `checkin_id_cliente` /
 * `checkout_id_cliente`: o pull é quem a substitui, nunca há duas.
 *
 * Função pura: não altera as entradas. As jornadas que só existem na fila
 * ganham `id` provisório negativo (únicos entre si); um check-out sem jornada
 * aberta conhecida é ignorado — quem decide é o servidor quando a fila subir.
 */
export function sobreporAcoesPendentes(
  replica: readonly JornadaExibida[],
  acoes: readonly AcaoDeJornada[],
): JornadaExibida[] {
  const resultado = replica.map((jornada) => ({ ...jornada }));
  let proximoIdProvisorio = -1;

  const emOrdem = [...acoes].sort((a, b) =>
    a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : 0,
  );
  for (const acao of emOrdem) {
    if (acao.tipo === 'checkin') {
      if (resultado.some((jornada) => jornada.checkinIdCliente === acao.idCliente)) continue;
      const { payload } = acao;
      resultado.push({
        id: proximoIdProvisorio--,
        usuarioId: -1,
        status: StatusJornada.EM_ANDAMENTO,
        checkinAt: payload.registradoEm,
        checkinLatitude: payload.latitude,
        checkinLongitude: payload.longitude,
        checkinEndereco: payload.endereco ?? null,
        checkoutAt: null,
        checkoutLatitude: null,
        checkoutLongitude: null,
        checkoutEndereco: null,
        lancadoEmAtraso: false,
        criadoEm: payload.registradoEm,
        pedidoId: payload.pedidoId ?? null,
        checkinIdCliente: acao.idCliente,
        checkoutIdCliente: null,
      });
      continue;
    }

    if (resultado.some((jornada) => jornada.checkoutIdCliente === acao.idCliente)) continue;
    const indice = indiceDaEmAndamentoMaisRecente(resultado);
    if (indice === -1) continue;
    const { payload } = acao;
    resultado[indice] = {
      ...resultado[indice],
      status: StatusJornada.FINALIZADA,
      checkoutAt: payload.registradoEm,
      checkoutLatitude: payload.latitude,
      checkoutLongitude: payload.longitude,
      checkoutEndereco: payload.endereco ?? null,
      checkoutIdCliente: acao.idCliente,
    };
  }
  return resultado;
}

export function queryJornadas(database: Database): Query<Jornada> {
  return database.get<Jornada>('jornadas').query();
}

export function queryAcoesDeJornada(database: Database): Query<AcaoPendente> {
  return database
    .get<AcaoPendente>('acoes_pendentes')
    .query(
      Q.where('tipo', Q.oneOf(['checkin', 'checkout'])),
      Q.where('status', Q.oneOf(STATUS_NA_SOBREPOSICAO)),
    );
}

/** Leitura única de réplica + fila — o que `useJornadasComPendentes` observa, sem a assinatura. */
export async function lerJornadasComPendentes(database: Database): Promise<JornadaExibida[]> {
  const [registros, acoes] = await Promise.all([
    queryJornadas(database).fetch(),
    queryAcoesDeJornada(database).fetch(),
  ]);
  return sobreporAcoesPendentes(
    registros.map(paraJornadaExibida),
    acoes.flatMap((acao) => paraAcaoDeJornada(acao) ?? []),
  );
}
