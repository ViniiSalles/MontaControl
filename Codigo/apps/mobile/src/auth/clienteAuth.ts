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

/**
 * Teto de espera da revalidação de `GET /auth/me` (boot e segundo plano). O
 * `fetch` do RN não tem timeout próprio: contra um host inalcançável (API fora
 * do ar, firewall descartando pacotes, IP da rede mudou) ele espera o timeout
 * do SO, minutos. Estourar aqui cai no ramo de "falha de rede": a sessão
 * guardada é mantida e o app segue usável (o boot já não espera pela rede).
 */
export const TIMEOUT_REVALIDACAO_MS = 5000;

/**
 * Teto de espera de `POST /auth/refresh`. Roda em segundo plano, quando uma
 * chamada autenticada tomou 401 — não segura nenhuma tela, e em rede ruim de
 * campo ele precisa de mais fôlego que a revalidação. Estourar é falha de
 * rede: a sessão fica e a ação segue pendente para a próxima tentativa.
 */
export const TIMEOUT_REFRESH_MS = 20000;

async function fetchComTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controlador.signal });
  } finally {
    clearTimeout(temporizador);
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
  const resposta = await fetchComTimeout(
    `${urlBaseApi}/api/auth/me`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    TIMEOUT_REVALIDACAO_MS,
  );

  // TI02: token expirado devolve 401 e o app precisa distinguir isso de um
  // erro de rede, para tentar o refresh antes de exigir novo login.
  if (resposta.status === 401) throw new ErroNaoAutorizado('Sessão expirada');
  if (!resposta.ok) throw await lerErro(resposta);

  return (await resposta.json()) as UsuarioDTO;
}

/**
 * POST /api/auth/refresh — troca o refresh token por uma sessão nova (TI02).
 *
 * `ErroNaoAutorizado` só quando o servidor **recusa** o refresh token (4xx):
 * é o que encerra a sessão. 5xx, 408 e 429 são falha transitória do servidor
 * — lançam um erro comum (tratado como falha de rede) e a sessão é mantida.
 */
export async function renovarSessao(refreshToken: string): Promise<LoginResponse> {
  const resposta = await fetchComTimeout(
    `${urlBaseApi}/api/auth/refresh`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    },
    TIMEOUT_REFRESH_MS,
  );

  if (!resposta.ok) {
    const recusado =
      resposta.status >= 400 && resposta.status < 500 && ![408, 429].includes(resposta.status);
    if (recusado) throw new ErroNaoAutorizado('Refresh token inválido ou expirado');
    throw new Error(`Não foi possível renovar a sessão agora (HTTP ${resposta.status}).`);
  }

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
