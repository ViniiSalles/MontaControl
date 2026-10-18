import type { AvariaDTO, ReportarAvariaRequest } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';
import type { OpcoesEnvio } from '../jornada/clienteJornadas';

/** POST /api/avarias — reporta problema na peça; idempotente por `idCliente` (outbox). */
export async function enviarAvaria(
  dados: ReportarAvariaRequest,
  opcoes: OpcoesEnvio = {},
): Promise<AvariaDTO> {
  const resposta = await requisitarAutenticado('/api/avarias', {
    metodo: 'POST',
    corpo: dados,
    geracao: opcoes.geracao,
  });
  return (await resposta.json()) as AvariaDTO;
}
