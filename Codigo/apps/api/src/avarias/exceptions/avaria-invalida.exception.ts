import { UnprocessableEntityException } from '@nestjs/common';

export class AvariaInvalidaException extends UnprocessableEntityException {
  constructor(motivo: string) {
    super(`Avaria inválida: ${motivo}`);
  }
}
