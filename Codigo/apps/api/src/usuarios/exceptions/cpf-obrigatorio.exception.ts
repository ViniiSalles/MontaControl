import { BadRequestException } from '@nestjs/common';

export class CpfObrigatorioException extends BadRequestException {
  constructor() {
    super('CPF é obrigatório para montadores');
  }
}
