import { UnprocessableEntityException } from '@nestjs/common';

export class FotoUsuarioInvalidaException extends UnprocessableEntityException {
  constructor(motivo: string) {
    super(`Foto inválida: ${motivo}`);
  }
}
