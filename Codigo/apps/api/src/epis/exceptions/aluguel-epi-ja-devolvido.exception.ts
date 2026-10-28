import { ConflictException } from '@nestjs/common';

export class AluguelEpiJaDevolvidoException extends ConflictException {
  constructor() {
    super('Esse aluguel já foi devolvido');
  }
}
