import type { CorpoErroPadrao, LoginResponse } from '@montacontrol/shared'

/**
 * Erro de autenticação com o `codigo` discriminado do corpo de erro da API
 * (`CREDENCIAIS_INVALIDAS` — N1T2 — vs. qualquer outro código) preservado,
 * para a UI escolher variante/mensagem de `<Alerta>` sem re-parsear texto.
 */
export class ErroAutenticacao extends Error {
  readonly codigo: string

  constructor(codigo: string, mensagem: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

/** POST /api/auth/login — ver `HttpExceptionFilter` para o formato do corpo de erro. */
export async function entrarComCredenciais(email: string, senha: string): Promise<LoginResponse> {
  const resposta = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as CorpoErroPadrao | null
    throw new ErroAutenticacao(
      corpo?.codigo ?? 'ERRO_DESCONHECIDO',
      corpo?.message ?? 'Não foi possível entrar. Tente novamente.',
    )
  }

  return (await resposta.json()) as LoginResponse
}
