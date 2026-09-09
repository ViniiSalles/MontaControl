import { NotFoundException } from '@nestjs/common';

export class AtestadoNaoEncontradoException extends NotFoundException {
  constructor() {
    super('Atestado não encontrado');
  }
}
