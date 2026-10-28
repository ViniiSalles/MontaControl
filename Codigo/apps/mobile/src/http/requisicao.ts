import { comTokenRenovado } from '../auth/tokenSessao';
import { urlBaseApi } from '../config/api';
import { lerErro } from './erroApi';

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PATCH';
  /** Serializado como JSON. */
  corpo?: unknown;
  /** Geração da sessão a que a requisição pertence (ver `comTokenRenovado`); a fila de ações passa a sua. */
  geracao?: number;
}

/**
 * Único caminho de saída das chamadas autenticadas à API: usa o token da
 * sessão (`comTokenRenovado`: 401 renova uma vez e repete) e converte
 * resposta não-2xx em `ErroApi`. Os clientes de domínio só montam caminho e
 * corpo — nenhum deles recebe ou guarda token.
 */
export function requisitarAutenticado(
  caminho: string,
  { metodo = 'GET', corpo, geracao }: OpcoesRequisicao = {},
): Promise<Response> {
  return comTokenRenovado(async (token) => {
    const resposta = await fetch(`${urlBaseApi}${caminho}`, {
      method: metodo,
      headers: {
        ...(corpo !== undefined && { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });

    if (!resposta.ok) throw await lerErro(resposta);
    return resposta;
  }, geracao);
}
