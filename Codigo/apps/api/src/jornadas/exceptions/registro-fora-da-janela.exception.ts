import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * O registro precisa ser do dia corrente ou do dia anterior. O dia anterior
 * cobre o aparelho que passou a noite sem rede; mais que isso é relógio
 * errado ou lançamento indevido, e o caminho correto é o ponto em atraso.
 */
export class RegistroForaDaJanelaException extends HttpException {
  readonly codigo = 'REGISTRO_FORA_DA_JANELA';

  constructor() {
    super(
      'Este registro está fora da janela aceita. Use o ponto em atraso para lançá-lo.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
