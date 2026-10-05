import { NotFoundException } from '@nestjs/common';

export class EquipeNaoEncontradaException extends NotFoundException {
  constructor() {
    super('Equipe não encontrada');
  }
}
