import type { AvariaDTO, ReportarAvariaRequest, TipoAvariaDTO } from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';
import type { OpcoesEnvio } from '../jornada/clienteJornadas';

async function buscar<T>(caminho: string): Promise<T> {
  const resposta = await requisitarAutenticado(caminho);
  return (await resposta.json()) as T;
}

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

/** GET /api/avarias/minhas — os próprios reportes, mais recente primeiro. */
export function listarMinhasAvarias(): Promise<AvariaDTO[]> {
  return buscar<AvariaDTO[]>('/api/avarias/minhas');
}

export function listarTiposAvaria(): Promise<TipoAvariaDTO[]> {
  return buscar<TipoAvariaDTO[]>('/api/avarias/tipos');
}
