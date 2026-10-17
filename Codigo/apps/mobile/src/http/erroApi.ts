import type { CorpoErroPadrao } from '@montacontrol/shared';

/**
 * Erro de resposta da API com o `codigo` do corpo padrão e o `status` HTTP
 * preservados. O `status` é o que a outbox usa para decidir entre descartar
 * (4xx de regra de negócio: a regra recusou, retentar não muda nada) e
 * manter na fila (401, 408, 429 e 5xx: nada foi decidido sobre a ação).
 */
export class ErroApi extends Error {
  readonly codigo: string;
  readonly status: number;

  constructor(codigo: string, mensagem: string, status: number) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

export async function lerErro(resposta: Response): Promise<ErroApi> {
  const corpo = (await resposta.json().catch(() => null)) as CorpoErroPadrao | null;
  return new ErroApi(
    corpo?.codigo ?? 'ERRO_DESCONHECIDO',
    corpo?.message ?? 'Não foi possível concluir a operação.',
    resposta.status,
  );
}
