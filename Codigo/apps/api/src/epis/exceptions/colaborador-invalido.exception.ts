import { UnprocessableEntityException } from '@nestjs/common';

export class ColaboradorInvalidoException extends UnprocessableEntityException {
  constructor() {
    super('Selecione um colaborador ativo');
  }
}
