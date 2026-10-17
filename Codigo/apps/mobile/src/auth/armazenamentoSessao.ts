import * as SecureStore from 'expo-secure-store';
import type { UsuarioDTO } from '@montacontrol/shared';

/**
 * Chave versionada: se o formato do que é guardado mudar, sobe a versão e a
 * leitura da anterior simplesmente devolve `null` (o montador refaz login) em
 * vez de desserializar um formato antigo. Mesma disciplina de
 * `client-localstorage-schema` aplicada na web.
 *
 * `.v2` passou a guardar também o `UsuarioDTO`: o app abre offline com o
 * usuário em cache (sem esperar `GET /auth/me`). A `.v1` só tinha tokens; é
 * apagada em `limparSessao` para não deixar token legado no aparelho.
 */
const CHAVE_SESSAO = 'mc.sessao.v2';
const CHAVE_SESSAO_LEGADA = 'mc.sessao.v1';

export interface TokensPersistidos {
  accessToken: string;
  refreshToken: string;
}

/**
 * Tokens + usuário (id, nome, e-mail, perfil, ativo — nada sensível além dos
 * tokens, que já vivem no mesmo Keychain/Keystore). O cache do usuário é
 * revalidado em segundo plano por `GET /auth/me` quando há rede, então um
 * montador desativado perde o acesso na primeira abertura com conexão.
 */
export interface SessaoPersistida extends TokensPersistidos {
  usuario: UsuarioDTO;
}

function ehSessaoPersistida(valor: Partial<SessaoPersistida> | null): valor is SessaoPersistida {
  return (
    !!valor &&
    typeof valor.accessToken === 'string' &&
    valor.accessToken.length > 0 &&
    typeof valor.refreshToken === 'string' &&
    valor.refreshToken.length > 0 &&
    !!valor.usuario &&
    typeof valor.usuario.id === 'number' &&
    typeof valor.usuario.nome === 'string' &&
    typeof valor.usuario.perfil === 'string'
  );
}

/**
 * Keychain (iOS) / Keystore (Android). Toda operação é best-effort: em um
 * aparelho sem hardware de segurança disponível o `SecureStore` lança, e
 * perder a persistência da sessão nunca pode derrubar o app — o pior caso
 * aceitável é o montador refazer login.
 */
export async function lerSessao(): Promise<SessaoPersistida | null> {
  try {
    const bruto = await SecureStore.getItemAsync(CHAVE_SESSAO);
    if (!bruto) return null;

    const analisado = JSON.parse(bruto) as Partial<SessaoPersistida> | null;
    return ehSessaoPersistida(analisado) ? analisado : null;
  } catch {
    // JSON corrompido ou SecureStore indisponível — trata como "sem sessão".
    return null;
  }
}

export async function salvarSessao(sessao: SessaoPersistida): Promise<void> {
  try {
    await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch {
    // Sessão segue válida em memória; só não sobrevive ao fechamento do app.
  }
}

export async function limparSessao(): Promise<void> {
  // Duas chamadas independentes: falhar em uma não pode impedir a outra.
  await Promise.all(
    [CHAVE_SESSAO, CHAVE_SESSAO_LEGADA].map(async (chave) => {
      try {
        await SecureStore.deleteItemAsync(chave);
      } catch {
        // Nada a fazer: o logout em memória já aconteceu.
      }
    }),
  );
}
