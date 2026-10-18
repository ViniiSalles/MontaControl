import { SYNC_SCHEMA_VERSION } from '@montacontrol/shared';
import type { SyncPullResponse } from '@montacontrol/shared';
import { ErroSessaoExpirada, geracaoDaSessao } from '../auth/tokenSessao';
import { requisitarAutenticado } from '../http/requisicao';

/**
 * Baixa as mudanças do servidor (`GET /api/sync/pull`) para o `synchronize()`.
 * Sai pela fonte única de token (`requisitarAutenticado`: 401 renova uma vez).
 *
 * `geracao` amarra o download à sessão que o pediu: se ela trocou (logout,
 * expiração, outro usuário) antes ou durante a requisição, falha com
 * `ErroSessaoExpirada` e NADA chega à réplica — a resposta é de outro usuário.
 *
 * O `schemaVersion` enviado é a versão do contrato (`SYNC_SCHEMA_VERSION`), não
 * a do schema local do WatermelonDB.
 */
export async function puxarMudancas(
  lastPulledAt: number | null,
  geracao: number,
): Promise<SyncPullResponse> {
  const consulta = new URLSearchParams();
  if (lastPulledAt) consulta.set('lastPulledAt', String(lastPulledAt));
  consulta.set('schemaVersion', String(SYNC_SCHEMA_VERSION));

  const resposta = await requisitarAutenticado(`/api/sync/pull?${consulta.toString()}`, { geracao });
  const mudancas = (await resposta.json()) as SyncPullResponse;

  if (geracaoDaSessao() !== geracao) throw new ErroSessaoExpirada();
  return mudancas;
}
