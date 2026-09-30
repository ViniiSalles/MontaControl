import { NotFoundException } from '@nestjs/common';

export class PecaNaoEncontradaException extends NotFoundException {
  constructor() {
    super('Peça não encontrada');
  }
}
