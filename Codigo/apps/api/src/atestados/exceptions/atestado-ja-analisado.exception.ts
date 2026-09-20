import { ConflictException } from '@nestjs/common';

/** Validar/rejeitar só sai de PENDENTE — a segunda análise é sempre erro do chamador. */
export class AtestadoJaAnalisadoException extends ConflictException {
  constructor() {
    super('Atestado já analisado');
  }
}
