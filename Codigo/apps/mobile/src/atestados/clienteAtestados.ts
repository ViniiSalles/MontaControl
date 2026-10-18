import type { AtestadoDTO, EnviarAtestadoRequest } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';
import type { OpcoesEnvio } from '../jornada/clienteJornadas';

/** POST /api/atestados — envia o atestado com foto(s); idempotente por `idCliente` (outbox). */
export async function enviarAtestado(
  dados: EnviarAtestadoRequest,
  opcoes: OpcoesEnvio = {},
): Promise<AtestadoDTO> {
  const resposta = await requisitarAutenticado('/api/atestados', {
    metodo: 'POST',
    corpo: dados,
    geracao: opcoes.geracao,
  });
  return (await resposta.json()) as AtestadoDTO;
}
