/**
 * Chaves dos stores persistidos no `localStorage` do banco local. Versionadas
 * como `mc.sessao.v2`: se o formato guardado mudar, sobe a versão e o estado
 * antigo simplesmente não é lido.
 *
 * Quem sobrevive a quê (ver `estadosDoUsuario`):
 * - `CHAVE_UI` (obra escolhida, rascunho de avaria): sobrevive à expiração
 *   forçada da sessão — é do mesmo montador dono da fila mantida — e morre no
 *   logout explícito e na troca de usuário (wipe do banco).
 * - `CHAVE_SINCRONIZACAO` (instante da última sincronização): descreve a
 *   réplica, então morre com ela — também na expiração forçada
 *   (`db/limparEspelho`).
 */
export const CHAVE_UI = 'mc.ui.v1';
export const CHAVE_SINCRONIZACAO = 'mc.sincronizacao.v1';
