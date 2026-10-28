import { NotFoundException } from '@nestjs/common';

export class NotificacaoNaoEncontradaException extends NotFoundException {
  constructor() {
    super('Notificação não encontrada');
  }
}
