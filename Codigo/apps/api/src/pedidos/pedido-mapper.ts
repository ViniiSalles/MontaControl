import type { AmbienteComPecasDTO, PedidoComAmbientesDTO, PedidoDTO } from '@montacontrol/shared';
import type { StatusAmbiente, StatusPedido } from '../../generated/prisma';
import { paraPecaDTO, SELECAO_PECA } from '../pecas/peca-mapper';

export const SELECAO_PEDIDO = {
  id: true,
  numeroPedido: true,
  status: true,
  clienteId: true,
} as const;

export const SELECAO_PEDIDO_COM_AMBIENTES = {
  ...SELECAO_PEDIDO,
  ambientes: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      nome: true,
      status: true,
      pecas: { orderBy: { id: 'asc' as const }, select: SELECAO_PECA },
    },
  },
} as const;

interface LinhaPedido {
  id: number;
  numeroPedido: string;
  status: StatusPedido;
  clienteId: number;
}

interface LinhaAmbiente {
  id: number;
  nome: string;
  status: StatusAmbiente;
  pecas: Parameters<typeof paraPecaDTO>[0][];
}

interface LinhaPedidoComAmbientes extends LinhaPedido {
  ambientes: LinhaAmbiente[];
}

export function paraPedidoDTO(linha: LinhaPedido): PedidoDTO {
  return {
    id: linha.id,
    numeroPedido: linha.numeroPedido,
    status: linha.status as unknown as PedidoDTO['status'],
    clienteId: linha.clienteId,
  };
}

function paraAmbienteComPecasDTO(linha: LinhaAmbiente): AmbienteComPecasDTO {
  return {
    id: linha.id,
    nome: linha.nome,
    status: linha.status as unknown as AmbienteComPecasDTO['status'],
    pecas: linha.pecas.map(paraPecaDTO),
  };
}

export function paraPedidoComAmbientesDTO(linha: LinhaPedidoComAmbientes): PedidoComAmbientesDTO {
  return {
    ...paraPedidoDTO(linha),
    ambientes: linha.ambientes.map(paraAmbienteComPecasDTO),
  };
}
