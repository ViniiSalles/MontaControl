import { ConflictException } from '@nestjs/common';

/** A avaria só anda para frente no fluxo de análise; pular ou voltar etapa é erro do chamador. */
export class TransicaoStatusAvariaInvalidaException extends ConflictException {
  constructor(de: string, para: string) {
    super(`Avaria não pode passar de ${de} para ${para}`);
  }
}
