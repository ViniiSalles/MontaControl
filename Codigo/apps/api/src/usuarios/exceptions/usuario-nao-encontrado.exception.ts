import { NotFoundException } from '@nestjs/common';

export class UsuarioNaoEncontradoException extends NotFoundException {
  constructor() {
    super('Usuário não encontrado');
  }
}
