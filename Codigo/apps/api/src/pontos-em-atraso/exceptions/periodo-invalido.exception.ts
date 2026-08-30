import { HttpException, HttpStatus } from '@nestjs/common';

/** A saída precisa ser depois da entrada — período de duração zero ou negativa não existe. */
export class PeriodoInvalidoException extends HttpException {
  readonly codigo = 'PERIODO_INVALIDO';

  constructor() {
    super('O horário de saída precisa ser depois do de entrada.', HttpStatus.BAD_REQUEST);
  }
}
