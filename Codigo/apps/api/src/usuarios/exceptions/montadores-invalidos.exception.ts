import { UnprocessableEntityException } from '@nestjs/common';

/** Só montador ativo vai para obra ou equipe — gestor, RH, operador ou inativo é recusado. */
export class MontadoresInvalidosException extends UnprocessableEntityException {
  constructor() {
    super('Selecione apenas montadores ativos');
  }
}
