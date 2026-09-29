import { ConflictException } from '@nestjs/common';

export class CpfJaCadastradoException extends ConflictException {
  constructor() {
    super('CPF já cadastrado');
  }
}
