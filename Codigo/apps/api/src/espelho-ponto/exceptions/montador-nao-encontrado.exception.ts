import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Cobre os dois casos (id não existe, ou existe mas não é MONTADOR) com a
 * mesma mensagem — o RH não precisa saber qual dos dois aconteceu.
 */
export class MontadorNaoEncontradoException extends HttpException {
  readonly codigo = 'MONTADOR_NAO_ENCONTRADO';

  constructor() {
    super('Montador não encontrado.', HttpStatus.NOT_FOUND);
  }
}
