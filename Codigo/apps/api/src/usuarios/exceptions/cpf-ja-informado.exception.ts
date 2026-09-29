import { ConflictException } from '@nestjs/common';

export class CpfJaInformadoException extends ConflictException {
  constructor() {
    super('CPF já informado');
  }
}
