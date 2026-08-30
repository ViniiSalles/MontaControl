import { HttpException, HttpStatus } from '@nestjs/common';
import { LIMITE_JORNADA_HORAS } from '@montacontrol/shared';

/**
 * A jornada aberta passou do limite sem check-out. Fechá-la agora
 * registraria uma saída que ninguém bateu; o caminho é o ponto em atraso,
 * e a próxima batida abre jornada nova.
 */
export class JornadaVencidaException extends HttpException {
  readonly codigo = 'JORNADA_VENCIDA';

  constructor() {
    super(
      `A jornada aberta passou de ${LIMITE_JORNADA_HORAS}h sem check-out. Use o ponto em atraso para registrar a saída.`,
      HttpStatus.CONFLICT,
    );
  }
}
