import { ConflictException } from '@nestjs/common';

export class NomeTipoEpiDuplicadoException extends ConflictException {
  constructor() {
    super('Já existe um EPI com esse nome');
  }
}
