import { HttpException, HttpStatus } from '@nestjs/common';

export class SemJornadaAbertaException extends HttpException {
  readonly codigo = 'SEM_JORNADA_ABERTA';

  constructor() {
    super('Não há jornada em andamento para encerrar.', HttpStatus.CONFLICT);
  }
}
