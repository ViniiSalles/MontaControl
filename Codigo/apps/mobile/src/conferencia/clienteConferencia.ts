import type { ConferenciaPecaDTO, ConferirPecaRequest } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';
import type { OpcoesEnvio } from '../jornada/clienteJornadas';

/** POST /api/pecas/conferencias — bipagem no descarregamento; idempotente (outbox). */
export async function enviarConferencia(
  dados: ConferirPecaRequest,
  opcoes: OpcoesEnvio = {},
): Promise<ConferenciaPecaDTO> {
  const resposta = await requisitarAutenticado('/api/pecas/conferencias', {
    metodo: 'POST',
    // Só os campos do contrato: a API recusa propriedade desconhecida (`forbidNonWhitelisted`).
    corpo: { pedidoId: dados.pedidoId, codigoBarras: dados.codigoBarras },
    geracao: opcoes.geracao,
  });
  return (await resposta.json()) as ConferenciaPecaDTO;
}
