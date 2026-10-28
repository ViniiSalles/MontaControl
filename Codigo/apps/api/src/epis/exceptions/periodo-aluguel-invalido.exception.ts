import { UnprocessableEntityException } from '@nestjs/common';

export class PeriodoAluguelInvalidoException extends UnprocessableEntityException {
  constructor() {
    super('A devolução prevista deve ser depois do início da reserva');
  }
}
