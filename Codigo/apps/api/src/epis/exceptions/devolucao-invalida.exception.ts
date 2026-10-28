import { UnprocessableEntityException } from '@nestjs/common';

export class DevolucaoInvalidaException extends UnprocessableEntityException {
  constructor() {
    super('A devolução deve ser entre o início do aluguel e agora');
  }
}
