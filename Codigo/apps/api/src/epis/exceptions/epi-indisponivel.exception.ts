import { ConflictException } from '@nestjs/common';

export class EpiIndisponivelException extends ConflictException {
  constructor() {
    super('Não há unidades suficientes desse EPI disponíveis no período');
  }
}
