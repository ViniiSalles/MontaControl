import { HttpException, HttpStatus } from '@nestjs/common';

export class SolicitacaoNaoEncontradaException extends HttpException {
  readonly codigo = 'SOLICITACAO_NAO_ENCONTRADA';

  constructor() {
    super('Solicitação de ponto não encontrada.', HttpStatus.NOT_FOUND);
  }
}
