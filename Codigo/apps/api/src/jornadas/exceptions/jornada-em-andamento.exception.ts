import { HttpException, HttpStatus } from '@nestjs/common';

/** Um montador só pode ter uma jornada aberta por vez. */
export class JornadaEmAndamentoException extends HttpException {
  readonly codigo = 'JORNADA_EM_ANDAMENTO';

  constructor() {
    super('Já existe uma jornada em andamento.', HttpStatus.CONFLICT);
  }
}
