import { Injectable } from '@nestjs/common';
import {
  StatusPedido,
  type CriarPedidoRequest,
  type PedidoComAmbientesDTO,
  type PedidoDTO,
  type PedidoResumoDTO,
} from '@montacontrol/shared';
import { ClientesRepository } from '../clientes/clientes.repository';
import { ClienteNaoEncontradoException } from './exceptions/cliente-nao-encontrado.exception';
import { PedidoNaoEncontradoException } from './exceptions/pedido-nao-encontrado.exception';
import { PedidosRepository } from './pedidos.repository';

@Injectable()
export class PedidosService {
  constructor(
    private readonly pedidos: PedidosRepository,
    private readonly clientes: ClientesRepository,
  ) {}

  async criar(dados: CriarPedidoRequest): Promise<PedidoDTO> {
    if (!(await this.clientes.existe(dados.clienteId))) throw new ClienteNaoEncontradoException();

    const pedido = await this.pedidos.criar(dados.clienteId, dados.ambientes);
    return {
      id: pedido.id,
      numeroPedido: pedido.numeroPedido,
      status: StatusPedido.AGUARDANDO,
      clienteId: dados.clienteId,
    };
  }

  async listar(status?: StatusPedido): Promise<PedidoResumoDTO[]> {
    return this.pedidos.listar(status);
  }

  async listarDoMontador(usuarioId: number): Promise<PedidoComAmbientesDTO[]> {
    return this.pedidos.listarDoMontador(usuarioId);
  }

  /** N7T3 — peças do pedido organizadas por ambiente, para conferência antes do despacho. */
  async buscarComAmbientes(numeroPedido: string): Promise<PedidoComAmbientesDTO> {
    const pedido = await this.pedidos.buscarComAmbientes(numeroPedido);
    if (!pedido) throw new PedidoNaoEncontradoException();
    return pedido;
  }
}
