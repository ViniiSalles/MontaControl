import { ConflictException } from '@nestjs/common';

export class SolicitacaoJaAnalisadaException extends ConflictException {
  constructor() {
    super('Solicitação de ponto já analisada');
  }
}
