import { NotFoundException } from '@nestjs/common';

export class PedidoNaoEncontradoException extends NotFoundException {
  constructor() {
    super('Pedido não encontrado');
  }
}
