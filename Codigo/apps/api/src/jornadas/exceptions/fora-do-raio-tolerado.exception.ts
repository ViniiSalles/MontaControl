import { HttpException, HttpStatus } from '@nestjs/common';

/** A marcação foi feita fora do raio de tolerância do cliente do pedido. */
export class ForaDoRaioToleradoException extends HttpException {
  readonly codigo = 'FORA_DO_RAIO_TOLERADO';

  constructor() {
    super('A marcação está fora do raio de tolerância do endereço do cliente.', HttpStatus.BAD_REQUEST);
  }
}
