import { NotFoundException } from '@nestjs/common';

export class AluguelEpiNaoEncontradoException extends NotFoundException {
  constructor() {
    super('Aluguel de EPI não encontrado');
  }
}
