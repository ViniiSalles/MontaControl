import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Já existe jornada cobrindo esse intervalo. Aprovar o pedido depois pagaria
 * a mesma hora duas vezes, então a recusa é na entrada, não na análise.
 */
export class PeriodoJaRegistradoException extends HttpException {
  readonly codigo = 'PERIODO_JA_REGISTRADO';

  constructor() {
    super('Já existe ponto registrado nesse intervalo.', HttpStatus.CONFLICT);
  }
}
