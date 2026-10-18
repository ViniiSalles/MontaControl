import type { Database, Query } from '@nozbe/watermelondb';
import type {
  AmbienteComPecasDTO,
  PecaDTO,
  PedidoDoMontadorDTO,
  StatusAmbiente,
  StatusPeca,
  StatusPedido,
} from '@montacontrol/shared';
import { Ambiente } from '../db/Ambiente';
import { Peca } from '../db/Peca';
import { Pedido } from '../db/Pedido';
import { COLUNAS_OBSERVADAS_DE_PEDIDO } from './obras';

/**
 * Pedido do montador como a API `GET /api/pedidos/meus` o devolvia, mas
 * montado a partir das tabelas da réplica (`pedidos`, `ambientes`, `pecas`).
 * Os ids locais são os do servidor, como string numérica.
 */
export type PedidoSemAmbientes = Omit<PedidoDoMontadorDTO, 'ambientes'>;
export type AmbienteSemPecas = Omit<AmbienteComPecasDTO, 'pecas'> & { pedidoId: number };

export const COLUNAS_OBSERVADAS_DE_PEDIDO_COMPLETO = [...COLUNAS_OBSERVADAS_DE_PEDIDO, 'status'];
export const COLUNAS_OBSERVADAS_DE_AMBIENTE = ['pedido_id', 'nome', 'status'];
export const COLUNAS_OBSERVADAS_DE_PECA = [
  'ambiente_id',
  'codigo_barras',
  'descricao',
  'quantidade',
  'status',
];

export const queryPedidosDoMontador = (database: Database): Query<Pedido> =>
  database.get<Pedido>('pedidos').query();
export const queryAmbientesDoMontador = (database: Database): Query<Ambiente> =>
  database.get<Ambiente>('ambientes').query();
export const queryPecasDoMontador = (database: Database): Query<Peca> =>
  database.get<Peca>('pecas').query();

export function paraPedidoDoMontador(pedido: Pedido): PedidoSemAmbientes {
  return {
    id: Number(pedido.id),
    numeroPedido: pedido.numeroPedido,
    status: pedido.status as StatusPedido,
    clienteId: Number(pedido.clienteId),
    cliente: {
      nome: pedido.clienteNome,
      endereco: pedido.clienteEndereco,
      cidade: pedido.clienteCidade,
      estado: pedido.clienteEstado,
      latitude: pedido.clienteLatitude,
      longitude: pedido.clienteLongitude,
    },
  };
}

export function paraAmbienteDoMontador(ambiente: Ambiente): AmbienteSemPecas {
  return {
    id: Number(ambiente.id),
    pedidoId: Number(ambiente.pedidoId),
    nome: ambiente.nome,
    status: ambiente.status as StatusAmbiente,
  };
}

export function paraPecaDoMontador(peca: Peca): PecaDTO {
  return {
    id: Number(peca.id),
    ambienteId: Number(peca.ambienteId),
    codigoBarras: peca.codigoBarras,
    descricao: peca.descricao,
    quantidade: peca.quantidade,
    status: peca.status as StatusPeca,
  };
}

/** Pedidos por número; ambientes e peças por id (a ordem em que foram cadastrados). */
export function montarPedidosDoMontador(
  pedidos: readonly PedidoSemAmbientes[],
  ambientes: readonly AmbienteSemPecas[],
  pecas: readonly PecaDTO[],
): PedidoDoMontadorDTO[] {
  return [...pedidos]
    .sort((a, b) => a.numeroPedido.localeCompare(b.numeroPedido))
    .map((pedido) => ({
      ...pedido,
      ambientes: ambientes
        .filter((ambiente) => ambiente.pedidoId === pedido.id)
        .sort((a, b) => a.id - b.id)
        .map((ambiente) => ({
          id: ambiente.id,
          nome: ambiente.nome,
          status: ambiente.status,
          pecas: pecas
            .filter((peca) => peca.ambienteId === ambiente.id)
            .sort((a, b) => a.id - b.id),
        })),
    }));
}
