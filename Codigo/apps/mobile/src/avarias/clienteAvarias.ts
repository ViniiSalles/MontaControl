import type {
  AvariaDTO,
  PedidoComAmbientesDTO,
  ReportarAvariaRequest,
  TipoAvariaDTO,
} from '@montacontrol/shared';
import { lerErro } from '../jornada/clienteJornadas';
import { urlBaseApi } from '../config/api';

async function buscar<T>(caminho: string, token: string): Promise<T> {
  const resposta = await fetch(`${urlBaseApi}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as T;
}

/** POST /api/avarias — reporta problema na peça; idempotente por `idCliente` (outbox). */
export async function enviarAvaria(token: string, dados: ReportarAvariaRequest): Promise<AvariaDTO> {
  const resposta = await fetch(`${urlBaseApi}/api/avarias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });
  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as AvariaDTO;
}

/** GET /api/avarias/minhas — os próprios reportes, mais recente primeiro. */
export function listarMinhasAvarias(token: string): Promise<AvariaDTO[]> {
  return buscar<AvariaDTO[]>('/api/avarias/minhas', token);
}

export function listarTiposAvaria(token: string): Promise<TipoAvariaDTO[]> {
  return buscar<TipoAvariaDTO[]>('/api/avarias/tipos', token);
}

/** GET /api/pedidos/meus — só os pedidos em que o montador está trabalhando, com as peças. */
export function listarMeusPedidos(token: string): Promise<PedidoComAmbientesDTO[]> {
  return buscar<PedidoComAmbientesDTO[]>('/api/pedidos/meus', token);
}
