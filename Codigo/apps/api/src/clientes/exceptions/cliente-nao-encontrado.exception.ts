import { NotFoundException } from '@nestjs/common';

export class ClienteNaoEncontradoException extends NotFoundException {
  constructor() {
    super('Cliente não encontrado');
  }
}
