import { UnprocessableEntityException } from '@nestjs/common';

export class FotoInvalidaException extends UnprocessableEntityException {
  constructor(motivo: string) {
    super(`Foto do atestado inválida: ${motivo}`);
  }
}
