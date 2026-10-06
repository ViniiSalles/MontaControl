import type { CorpoErroPadrao } from '@montacontrol/shared'

/** Erro de API com o `codigo` discriminado do `HttpExceptionFilter` preservado. */
export class ErroApi extends Error {
  readonly codigo: string
  readonly status: number

  constructor(codigo: string, mensagem: string, status: number) {
    super(mensagem)
    this.codigo = codigo
    this.status = status
  }
}

interface OpcoesRequisicao {
  token: string
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  corpo?: unknown
}

/**
 * Toda chamada autenticada da Web passa por aqui. O token vem sempre por
 * parâmetro, e não de um singleton: a sessão vive no `AuthContext` e some no
 * logout — guardar cópia em módulo é o caminho para requisição com token de
 * uma sessão que já acabou.
 */
export async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao): Promise<T> {
  const resposta = await fetch(caminho, {
    method: opcoes.metodo ?? 'GET',
    headers: {
      Authorization: `Bearer ${opcoes.token}`,
      ...(opcoes.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  })

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as CorpoErroPadrao | null
    throw new ErroApi(
      corpo?.codigo ?? 'ERRO_DESCONHECIDO',
      corpo?.message ?? 'Não foi possível concluir a operação. Tente novamente.',
      resposta.status,
    )
  }

  if (resposta.status === 204) return undefined as T
  return (await resposta.json()) as T
}
