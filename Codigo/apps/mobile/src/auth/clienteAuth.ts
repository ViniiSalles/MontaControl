import type { CorpoErroPadrao, LoginResponse, UsuarioDTO } from '@montacontrol/shared';
import { urlBaseApi } from '../config/api';

/**
 * Erro de autenticação com o `codigo` discriminado do corpo de erro da API
 * (`CREDENCIAIS_INVALIDAS` — N1T2 — vs. qualquer outro código) preservado,
 * para a UI escolher variante/mensagem de `<Alerta>` sem re-parsear texto.
 * Espelha `apps/web/src/auth/clienteAuth.ts`.
 */
export class ErroAutenticacao extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/** Sinaliza 401 sem tratar como falha definitiva — quem chama decide se tenta o refresh (TI02). */
export class ErroNaoAutorizado extends Error {}

async function lerErro(resposta: Response): Promise<ErroAutenticacao> {
  const corpo = (await resposta.json().catch(() => null)) as CorpoErroPadrao | null;
  return new ErroAutenticacao(
    corpo?.codigo ?? 'ERRO_DESCONHECIDO',
    corpo?.message ?? 'Não foi possível entrar. Tente novamente.',
  );
}

/** POST /api/auth/login — ver `HttpExceptionFilter` para o formato do corpo de erro. */
export async function entrarComCredenciais(email: string, senha: string): Promise<LoginResponse> {
  const resposta = await fetch(`${urlBaseApi}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });

  if (!resposta.ok) throw await lerErro(resposta);

  return (await resposta.json()) as LoginResponse;
}

/**
 * GET /api/auth/me — valida o access token guardado e devolve o usuário
 * corrente. É a rota que o guard do backend usa para recarregar o usuário,
 * então um montador desativado (`ativo = false`) cai aqui como 401, e não
 * só quando o token expirar.
 */
export async function buscarUsuarioAtual(accessToken: string): Promise<UsuarioDTO> {
  const resposta = await fetch(`${urlBaseApi}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // TI02: token expirado devolve 401 e o app precisa distinguir isso de um
  // erro de rede, para tentar o refresh antes de exigir novo login.
  if (resposta.status === 401) throw new ErroNaoAutorizado('Sessão expirada');
  if (!resposta.ok) throw await lerErro(resposta);

  return (await resposta.json()) as UsuarioDTO;
}

/** POST /api/auth/refresh — troca o refresh token por uma sessão nova (TI02). */
export async function renovarSessao(refreshToken: string): Promise<LoginResponse> {
  const resposta = await fetch(`${urlBaseApi}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!resposta.ok) throw new ErroNaoAutorizado('Refresh token inválido ou expirado');

  return (await resposta.json()) as LoginResponse;
}

/**
 * POST /api/auth/sair — revoga o refresh token no servidor. Best-effort: o
 * logout local nunca pode ficar refém da rede, então a falha é engolida por
 * quem chama.
 */
export async function encerrarSessaoNoServidor(accessToken: string): Promise<void> {
  await fetch(`${urlBaseApi}/api/auth/sair`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
