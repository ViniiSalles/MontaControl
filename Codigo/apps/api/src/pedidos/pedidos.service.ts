import { Injectable } from '@nestjs/common';
import type { PedidoComAmbientesDTO } from '@montacontrol/shared';
import { PedidoNaoEncontradoException } from './exceptions/pedido-nao-encontrado.exception';
import { PedidosRepository } from './pedidos.repository';

@Injectable()
export class PedidosService {
  constructor(private readonly pedidos: PedidosRepository) {}

  /** N7T3 — peças do pedido organizadas por ambiente, para conferência antes do despacho. */
  async buscarComAmbientes(numeroPedido: string): Promise<PedidoComAmbientesDTO> {
    const pedido = await this.pedidos.buscarComAmbientes(numeroPedido);
    if (!pedido) throw new PedidoNaoEncontradoException();
    return pedido;
  }
}
