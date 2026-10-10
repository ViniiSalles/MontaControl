import { HttpException, HttpStatus } from '@nestjs/common';

/** O `pedidoId` da marcação não existe ou não está atribuído ao montador. */
export class PedidoInvalidoException extends HttpException {
  readonly codigo = 'PEDIDO_INVALIDO';

  constructor() {
    super('O pedido informado não foi encontrado entre as suas obras.', HttpStatus.BAD_REQUEST);
  }
}
