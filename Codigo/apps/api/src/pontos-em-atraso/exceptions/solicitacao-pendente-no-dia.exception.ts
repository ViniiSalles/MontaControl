import { HttpException, HttpStatus } from '@nestjs/common';

/** Uma fila por dia: um segundo pedido pendente no mesmo dia só duplica a análise do gestor. */
export class SolicitacaoPendenteNoDiaException extends HttpException {
  readonly codigo = 'SOLICITACAO_PENDENTE_NO_DIA';

  constructor() {
    super('Você já tem um pedido em análise para esse dia.', HttpStatus.CONFLICT);
  }
}
