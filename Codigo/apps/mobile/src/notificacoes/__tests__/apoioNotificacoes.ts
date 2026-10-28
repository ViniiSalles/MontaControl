import type { SyncNotificacaoRow } from '@montacontrol/shared';

let sequencia = 100;

/** Linha de notificação do contrato: não lida, AVARIA_ATUALIZADA; `parcial` sobrescreve. */
export function linhaDeNotificacao(parcial: Partial<SyncNotificacaoRow> = {}): SyncNotificacaoRow {
  sequencia += 1;
  return {
    id: String(sequencia),
    tipo: 'AVARIA_ATUALIZADA',
    titulo: `Notificação ${sequencia}`,
    mensagem: `Mensagem ${sequencia}`,
    referencia_tipo: null,
    referencia_id: null,
    lida: false,
    criada_em: '2026-10-14T15:00:00.000Z',
    ...parcial,
  };
}
