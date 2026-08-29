import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Perfil } from '@montacontrol/shared';
import type { LoginResponse, UsuarioDTO } from '@montacontrol/shared';
import {
  buscarUsuarioAtual,
  encerrarSessaoNoServidor,
  entrarComCredenciais,
  ErroAutenticacao,
  ErroNaoAutorizado,
  renovarSessao,
} from './clienteAuth';
import { limparTokens, lerTokens, salvarTokens } from './armazenamentoSessao';
import type { TokensPersistidos } from './armazenamentoSessao';

export const CODIGO_PERFIL_EXCLUSIVO_WEB = 'PERFIL_EXCLUSIVO_WEB';

const MENSAGEM_PERFIL_EXCLUSIVO_WEB =
  'Este perfil acessa o MontaControl pelo sistema web. O aplicativo é exclusivo do Montador.';

export interface SessaoAutenticada extends TokensPersistidos {
  usuario: UsuarioDTO;
}

interface ContextoAuth {
  /** `null` = sem sessão. Durante a restauração de boot é `null` com `restaurando = true`. */
  sessao: SessaoAutenticada | null;
  /** Verdadeiro enquanto o boot ainda decide entre Login e app autenticado — segura a splash. */
  restaurando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<ContextoAuth | null>(null);

/**
 * O app mobile é exclusivo do MONTADOR: GESTOR, RH e DEPOSITO são recusados
 * mesmo com credenciais corretas, e o token **nunca** é persistido nesse
 * caso (plano, "Destinos de N1T1"). O espelho disso está em
 * `apps/web/src/auth/AuthContext.tsx`, que recusa o MONTADOR.
 */
function exigirMontador(resposta: LoginResponse): void {
  if (resposta.usuario.perfil !== Perfil.MONTADOR) {
    throw new ErroAutenticacao(CODIGO_PERFIL_EXCLUSIVO_WEB, MENSAGEM_PERFIL_EXCLUSIVO_WEB);
  }
}

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoAutenticada | null>(null);
  const [restaurando, setRestaurando] = useState(true);

  useEffect(() => {
    // `cancelado` evita `setState` depois do unmount caso o app seja fechado
    // no meio da restauração (a splash ainda está na tela aqui).
    let cancelado = false;

    async function restaurar(): Promise<void> {
      const tokens = await lerTokens();
      if (!tokens) return;

      try {
        const usuario = await buscarUsuarioAtual(tokens.accessToken);
        if (usuario.perfil !== Perfil.MONTADOR) {
          await limparTokens();
          return;
        }
        if (!cancelado) setSessao({ ...tokens, usuario });
      } catch (excecao) {
        // Só um 401 justifica gastar o refresh token. Falha de rede mantém
        // os tokens guardados para a próxima abertura do app.
        if (!(excecao instanceof ErroNaoAutorizado)) return;

        try {
          // TI02: access token expirado renova em silêncio; se o refresh
          // também morreu, a sessão acabou e o app volta ao Login.
          const renovada = await renovarSessao(tokens.refreshToken);
          exigirMontador(renovada);

          const novosTokens = {
            accessToken: renovada.accessToken,
            refreshToken: renovada.refreshToken,
          };
          await salvarTokens(novosTokens);
          if (!cancelado) setSessao({ ...novosTokens, usuario: renovada.usuario });
        } catch {
          await limparTokens();
        }
      }
    }

    void restaurar().finally(() => {
      if (!cancelado) setRestaurando(false);
    });

    return () => {
      cancelado = true;
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await entrarComCredenciais(email, senha);
    exigirMontador(resposta);

    const tokens = { accessToken: resposta.accessToken, refreshToken: resposta.refreshToken };
    await salvarTokens(tokens);
    setSessao({ ...tokens, usuario: resposta.usuario });
  }, []);

  const sair = useCallback(async () => {
    // Ordem deliberada: derruba a sessão local primeiro, para que a rede
    // lenta (ou ausente — o app é offline-first) nunca prenda o montador
    // numa tela da qual ele pediu para sair.
    const encerrando = sessao;
    setSessao(null);
    await limparTokens();
    if (encerrando) {
      await encerrarSessaoNoServidor(encerrando.accessToken).catch(() => undefined);
    }
  }, [sessao]);

  const valor = useMemo(
    () => ({ sessao, restaurando, entrar, sair }),
    [sessao, restaurando, entrar, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth deve ser usado dentro de <ProvedorAuth>');
  return contexto;
}
