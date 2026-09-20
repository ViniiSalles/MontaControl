import { UnprocessableEntityException } from '@nestjs/common';

export class PeriodoAtestadoInvalidoException extends UnprocessableEntityException {
  constructor(motivo: string) {
    super(`Período do atestado inválido: ${motivo}`);
  }
}
