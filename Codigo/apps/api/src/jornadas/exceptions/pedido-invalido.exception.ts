import { HttpException, HttpStatus } from '@nestjs/common';

/** O `pedidoId` informado na marcação não corresponde a um pedido existente. */
export class PedidoInvalidoException extends HttpException {
  readonly codigo = 'PEDIDO_INVALIDO';

  constructor() {
    super('O pedido informado não foi encontrado.', HttpStatus.BAD_REQUEST);
  }
}
