import { HttpException, HttpStatus } from '@nestjs/common';

export class CheckoutAntesDoCheckinException extends HttpException {
  readonly codigo = 'CHECKOUT_ANTES_DO_CHECKIN';

  constructor() {
    super('O check-out não pode ser anterior ao check-in.', HttpStatus.BAD_REQUEST);
  }
}
