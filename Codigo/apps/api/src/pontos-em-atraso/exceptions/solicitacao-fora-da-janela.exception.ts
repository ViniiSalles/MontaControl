import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * O ponto em atraso corrige o passado recente, não o futuro nem o arquivo
 * morto. O limite retroativo acompanha o maior período do histórico (30
 * dias): o que o montador não consegue mais ver, ele também não lança.
 */
export class SolicitacaoForaDaJanelaException extends HttpException {
  readonly codigo = 'SOLICITACAO_FORA_DA_JANELA';

  constructor(limiteDias: number) {
    super(
      `A data precisa estar entre hoje e ${limiteDias} dias atrás.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
