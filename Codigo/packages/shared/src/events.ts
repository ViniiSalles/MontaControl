/**
 * Eventos de tempo real (WebSocket / Socket.io).
 * Fonte: Diagramas de Sequência (Seção 3.2) — alertas ao Dashboard do Gestor.
 */

export const WS_EVENTS = {
  AVARIA_REPORTADA: 'avaria:reportada',
  CHECKIN_REALIZADO: 'jornada:checkin',
  CHECKOUT_REALIZADO: 'jornada:checkout',
  ATESTADO_ENVIADO: 'atestado:enviado',
  PECA_INCONSISTENTE: 'peca:inconsistente',
  REPOSICAO_SOLICITADA: 'avaria:reposicao_solicitada',
  NOTIFICACAO_NOVA: 'notificacao:nova',
} as const;

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export interface AvariaReportadaPayload {
  avariaId: number;
  pecaId: number;
  codigoBarras: string;
  tipoAvaria: string;
  montador: string;
  registradaEm: string;
}

export interface CheckinPayload {
  jornadaId: number;
  usuarioId: number;
  montador: string;
  latitude: number;
  longitude: number;
  em: string;
}
