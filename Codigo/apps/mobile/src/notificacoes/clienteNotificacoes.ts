import { requisitarAutenticado } from '../http/requisicao';

/**
 * PATCH /api/notificacoes/:id/lida — marca uma notificação como lida (204, sem
 * corpo: a resposta não é lida). `id` é o id numérico do servidor; o id local da
 * réplica é essa mesma string, então quem chama converte com `Number(...)`.
 * Online-only: não passa pela fila de ações.
 */
export async function marcarNotificacaoLida(id: number): Promise<void> {
  await requisitarAutenticado(`/api/notificacoes/${id}/lida`, { metodo: 'PATCH' });
}

/** POST /api/notificacoes/marcar-todas-lidas — marca todas as do usuário (204, sem corpo). */
export async function marcarTodasNotificacoesLidas(): Promise<void> {
  await requisitarAutenticado('/api/notificacoes/marcar-todas-lidas', { metodo: 'POST' });
}
