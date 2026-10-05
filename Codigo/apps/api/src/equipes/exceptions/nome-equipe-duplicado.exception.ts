import { ConflictException } from '@nestjs/common';

export class NomeEquipeDuplicadoException extends ConflictException {
  constructor() {
    super('Já existe uma equipe com esse nome');
  }
}
