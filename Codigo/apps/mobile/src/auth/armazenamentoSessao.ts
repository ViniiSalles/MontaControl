import * as SecureStore from 'expo-secure-store';

/**
 * Chave versionada: se o formato do que é guardado mudar, sobe para `.v2` e
 * a leitura da v1 simplesmente devolve `null` (o montador refaz login) em
 * vez de desserializar um formato antigo. Mesma disciplina de
 * `client-localstorage-schema` aplicada na web.
 */
const CHAVE_SESSAO = 'mc.sessao.v1';

/**
 * Só os tokens são persistidos. O `usuario` não: ele é sempre recarregado
 * de `GET /api/auth/me` no boot, então nome/perfil/`ativo` nunca ficam
 * defasados em relação ao banco — um montador desativado perde o acesso na
 * próxima abertura do app, e não só quando o token expira.
 */
export interface TokensPersistidos {
  accessToken: string;
  refreshToken: string;
}

/**
 * Keychain (iOS) / Keystore (Android). Toda operação é best-effort: em um
 * aparelho sem hardware de segurança disponível o `SecureStore` lança, e
 * perder a persistência da sessão nunca pode derrubar o app — o pior caso
 * aceitável é o montador refazer login.
 */
export async function lerTokens(): Promise<TokensPersistidos | null> {
  try {
    const bruto = await SecureStore.getItemAsync(CHAVE_SESSAO);
    if (!bruto) return null;

    const analisado = JSON.parse(bruto) as Partial<TokensPersistidos>;
    if (!analisado.accessToken || !analisado.refreshToken) return null;

    return { accessToken: analisado.accessToken, refreshToken: analisado.refreshToken };
  } catch {
    // JSON corrompido ou SecureStore indisponível — trata como "sem sessão".
    return null;
  }
}

export async function salvarTokens(tokens: TokensPersistidos): Promise<void> {
  try {
    await SecureStore.setItemAsync(CHAVE_SESSAO, JSON.stringify(tokens));
  } catch {
    // Sessão segue válida em memória; só não sobrevive ao fechamento do app.
  }
}

export async function limparTokens(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO);
  } catch {
    // Nada a fazer: o logout em memória já aconteceu.
  }
}
