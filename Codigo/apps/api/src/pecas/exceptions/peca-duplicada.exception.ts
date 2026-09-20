import { ConflictException } from '@nestjs/common';

/** N7T2 — código de barras já triado antes; bloqueia o registro duplicado. */
export class PecaDuplicadaException extends ConflictException {
  constructor() {
    super('Peça já cadastrada: este código de barras já foi triado');
  }
}
