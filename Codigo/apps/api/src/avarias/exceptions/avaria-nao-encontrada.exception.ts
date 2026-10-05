import { NotFoundException } from '@nestjs/common';

export class AvariaNaoEncontradaException extends NotFoundException {
  constructor() {
    super('Avaria não encontrada');
  }
}
