import { Perfil } from '@montacontrol/shared';
import type { UsuarioDTO } from '@montacontrol/shared';
import { ErroApi } from '../http/erroApi';
import { salvarSessao } from './armazenamentoSessao';
import type { TokensPersistidos } from './armazenamentoSessao';
import { ErroNaoAutorizado, renovarSessao } from './clienteAuth';

/**
 * Fonte única do token de acesso — usada por todos os clientes HTTP e pelo
 * sync. Vive fora do React (módulo singleton) porque quem precisa do token
 * inclui código sem árvore de componentes (`syncManager`, outbox). Quem
 * escreve é o `AuthContext` (login, boot, logout) e a própria renovação.
 *
 * Contrato para os chamadores:
 * - `obterTokenValido()` devolve o token atual (esperando uma renovação em
 *   andamento) ou falha com `ErroSessaoExpirada` se não há sessão;
 * - `comTokenRenovado(fn)` é o que envolve toda chamada autenticada: no 401
 *   renova uma vez e repete `fn`. Falha de rede na renovação propaga como
 *   falha de rede — a sessão só acaba quando o servidor recusa o refresh.
 */

/** Não há sessão (ou ela acabou). Não é `ErroApi`: para a fila de envio isto é "ainda não dá", nunca "recusado". */
export class ErroSessaoExpirada extends Error {
  constructor() {
    super('Sessão expirada. Entre novamente.');
  }
}

let tokens: TokensPersistidos | null = null;
let renovacaoEmCurso: Promise<string> | null = null;
let avisoSessaoExpirada: (() => void | Promise<void>) | null = null;

/** Troca a sessão em memória. `null` = sem sessão. Chamado no login, no boot e no logout. */
export function definirTokens(novos: TokensPersistidos | null): void {
  tokens = novos;
}

/**
 * Registra quem encerra a sessão local quando o servidor recusa o refresh
 * token (o `AuthContext` limpa tokens, banco local e volta ao Login).
 * Devolve a função que cancela o registro.
 */
export function aoSessaoExpirar(aviso: () => void | Promise<void>): () => void {
  avisoSessaoExpirada = aviso;
  return () => {
    if (avisoSessaoExpirada === aviso) avisoSessaoExpirada = null;
  };
}

/** Guarda o usuário revalidado em `/auth/me` junto dos tokens atuais. Sem sessão em memória, não faz nada. */
export async function atualizarUsuarioDaSessao(usuario: UsuarioDTO): Promise<void> {
  if (!tokens) return;
  await salvarSessao({ ...tokens, usuario });
}

/** Token em memória, sem esperar renovação nem falhar — para o logout, que não pode ficar refém da rede. */
export function lerTokenAtual(): string | null {
  return tokens?.accessToken ?? null;
}

export async function obterTokenValido(): Promise<string> {
  // Uma renovação em andamento troca o token; quem pede agora deve receber o novo.
  if (renovacaoEmCurso) await renovacaoEmCurso.catch(() => undefined);
  if (!tokens) throw new ErroSessaoExpirada();
  return tokens.accessToken;
}

function ehNaoAutorizado(erro: unknown): boolean {
  return erro instanceof ErroNaoAutorizado || (erro instanceof ErroApi && erro.status === 401);
}

/**
 * Executa `fn` com o token atual; se o servidor responder 401, renova a
 * sessão e repete `fn` **uma** vez com o token novo.
 */
export async function comTokenRenovado<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await obterTokenValido();
  try {
    return await fn(token);
  } catch (erro) {
    if (!ehNaoAutorizado(erro)) throw erro;
    return fn(await renovarToken(token));
  }
}

async function encerrar(): Promise<never> {
  tokens = null;
  await avisoSessaoExpirada?.();
  throw new ErroSessaoExpirada();
}

async function executarRenovacao(refreshToken: string): Promise<string> {
  let resposta;
  try {
    resposta = await renovarSessao(refreshToken);
  } catch (erro) {
    // Só a recusa do servidor acaba com a sessão; falha de rede propaga como está.
    if (erro instanceof ErroNaoAutorizado) return encerrar();
    throw erro;
  }

  // Mesma regra do login: o app é exclusivo do MONTADOR.
  if (resposta.usuario.perfil !== Perfil.MONTADOR) return encerrar();

  // Logout (ou outro login) durante a requisição: não ressuscitar a sessão antiga.
  if (!tokens) throw new ErroSessaoExpirada();
  if (tokens.refreshToken !== refreshToken) return tokens.accessToken;

  tokens = { accessToken: resposta.accessToken, refreshToken: resposta.refreshToken };
  await salvarSessao({ ...tokens, usuario: resposta.usuario });
  return resposta.accessToken;
}

/** Renova (uma só vez, mesmo com vários 401 simultâneos) e devolve o access token novo. */
function renovarToken(tokenRejeitado: string): Promise<string> {
  if (renovacaoEmCurso) return renovacaoEmCurso;
  if (!tokens) return Promise.reject(new ErroSessaoExpirada());
  // Outra chamada já trocou o token que esta usou: basta repetir com o atual.
  if (tokens.accessToken !== tokenRejeitado) return Promise.resolve(tokens.accessToken);

  const emCurso = executarRenovacao(tokens.refreshToken).finally(() => {
    renovacaoEmCurso = null;
  });
  renovacaoEmCurso = emCurso;
  return emCurso;
}
