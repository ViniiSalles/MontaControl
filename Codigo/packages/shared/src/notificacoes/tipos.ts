/**
 * Notificações em tempo real (WebSocket) e centro de notificações do usuário.
 * Cada notificação é persistida por destinatário e empurrada pelo evento
 * `WS_EVENTS.NOTIFICACAO_NOVA` (payload: `NotificacaoDTO`).
 */

export const TIPOS_NOTIFICACAO = [
  'AVARIA_REPORTADA',
  'AVARIA_ATUALIZADA',
  'ATESTADO_ENVIADO',
  'ATESTADO_VALIDADO',
  'ATESTADO_REJEITADO',
  'PECA_INCONSISTENTE',
  'PONTO_ATRASO_SOLICITADO',
  'PONTO_ATRASO_APROVADO',
  'PONTO_ATRASO_REJEITADO',
] as const;

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number];

/** Entidade a que a notificação se refere (para navegação ao tocar nela). */
export type ReferenciaNotificacao = 'AVARIA' | 'ATESTADO' | 'PECA' | 'PONTO_ATRASO';

export interface NotificacaoDTO {
  id: number;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  referenciaTipo: ReferenciaNotificacao | null;
  referenciaId: number | null;
  lida: boolean;
  /** ISO 8601. */
  criadaEm: string;
}

export interface ListaNotificacoesDTO {
  itens: NotificacaoDTO[];
  naoLidas: number;
  /** Cursor (id) da próxima página; `null` quando não há mais itens. */
  proximoCursor: number | null;
}
