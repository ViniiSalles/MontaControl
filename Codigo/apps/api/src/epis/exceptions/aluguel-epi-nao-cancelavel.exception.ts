import { ConflictException } from '@nestjs/common';

/** Aluguel que já começou é histórico: registra-se a devolução, não se apaga. */
export class AluguelEpiNaoCancelavelException extends ConflictException {
  constructor() {
    super('Só é possível cancelar reservas que ainda não começaram');
  }
}
