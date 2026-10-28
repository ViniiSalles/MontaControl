import { NotFoundException } from '@nestjs/common';

export class TipoEpiNaoEncontradoException extends NotFoundException {
  constructor() {
    super('EPI não encontrado');
  }
}
