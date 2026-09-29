import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Sem CPF não dá para preencher o campo obrigatório do registro tipo 7 do
 * AFD — a exportação fica bloqueada até todos os nomes listados terem CPF
 * cadastrado (tela de Montadores, ação "Informar CPF").
 */
export class MontadoresSemCpfException extends UnprocessableEntityException {
  constructor(nomes: string[]) {
    super(`Sem CPF cadastrado: ${nomes.join(', ')}`);
  }
}
