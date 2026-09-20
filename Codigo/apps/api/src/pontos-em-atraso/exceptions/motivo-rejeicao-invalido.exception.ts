import { UnprocessableEntityException } from '@nestjs/common';

/** Rejeitar sem motivo preenchido deixa o montador sem saber o que corrigir. */
export class MotivoRejeicaoInvalidoException extends UnprocessableEntityException {
  constructor() {
    super('A rejeição exige motivo preenchido');
  }
}
