import { UnprocessableEntityException } from '@nestjs/common';

/** Reduzir o estoque abaixo do que está fora deixaria aluguéis em andamento sem unidade. */
export class EstoqueAbaixoDoEmUsoException extends UnprocessableEntityException {
  constructor() {
    super('O estoque não pode ficar abaixo das unidades que estão alugadas agora');
  }
}
