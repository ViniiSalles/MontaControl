import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Perfil } from '@montacontrol/shared';
import type { LoginResponse, UsuarioDTO } from '@montacontrol/shared';
import {
  buscarUsuarioAtual,
  encerrarSessaoNoServidor,
  entrarComCredenciais,
  ErroAutenticacao,
} from './clienteAuth';
import { lerSessao, limparSessao, salvarSessao } from './armazenamentoSessao';
import {
  aoSessaoExpirar,
  atualizarUsuarioDaSessao,
  comTokenRenovado,
  definirTokens,
  lerTokenAtual,
} from './tokenSessao';
import { limparBancoLocal } from '../db/database';

export const CODIGO_PERFIL_EXCLUSIVO_WEB = 'PERFIL_EXCLUSIVO_WEB';

const MENSAGEM_PERFIL_EXCLUSIVO_WEB =
  'Este perfil acessa o MontaControl pelo sistema web. O aplicativo é exclusivo do Montador.';

/**
 * Quem está logado. Os tokens não passam por aqui: vivem em `tokenSessao`
 * (`obterTokenValido` / `comTokenRenovado`), que renova sozinho — a tela
 * nunca segura um token que pode ter expirado.
 */
export interface SessaoAutenticada {
  usuario: UsuarioDTO;
}

interface ContextoAuth {
  /** `null` = sem sessão. Durante a restauração de boot é `null` com `restaurando = true`. */
  sessao: SessaoAutenticada | null;
  /** Verdadeiro só até a sessão guardada ser lida — segura a splash. Nunca espera a rede. */
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

  /**
   * Fim da sessão local — refresh recusado, perfil recusado. Limpa o espelho
   * do banco para que o próximo montador a logar neste aparelho não veja a
   * jornada do anterior.
   */
  const encerrarLocalmente = useCallback(async () => {
    definirTokens(null);
    setSessao(null);
    await limparSessao();
    await limparBancoLocal().catch(() => undefined);
  }, []);

  useEffect(() => {
    // `cancelado` evita `setState` depois do unmount caso o app seja fechado
    // no meio da restauração (a splash ainda está na tela aqui).
    let cancelado = false;

    // Refresh recusado durante a sessão (em qualquer chamada, não só no boot).
    const cancelarAviso = aoSessaoExpirar(encerrarLocalmente);

    /** Lê a sessão guardada e entra com ela na hora — sem rede, sem Login. */
    async function restaurar(): Promise<boolean> {
      const salva = await lerSessao();
      if (!salva) return false;

      if (salva.usuario.perfil !== Perfil.MONTADOR) {
        await encerrarLocalmente();
        return false;
      }

      definirTokens({ accessToken: salva.accessToken, refreshToken: salva.refreshToken });
      if (!cancelado) setSessao({ usuario: salva.usuario });
      return true;
    }

    /**
     * Segundo plano, depois de entrar: confere em `GET /auth/me` se a sessão
     * ainda vale (montador desativado, perfil trocado). 401 renova o token
     * (`comTokenRenovado`); refresh recusado encerra a sessão pelo aviso
     * registrado acima. Qualquer falha de rede mantém a sessão — é o caso
     * normal de quem abre o app numa obra sem sinal.
     */
    async function revalidar(): Promise<void> {
      try {
        const usuario = await comTokenRenovado((token) => buscarUsuarioAtual(token));
        if (cancelado) return;

        if (usuario.perfil !== Perfil.MONTADOR) {
          await encerrarLocalmente();
          return;
        }
        // Funcional: se o montador saiu enquanto a rede respondia, não ressuscita a sessão.
        setSessao((atual) => (atual ? { usuario } : atual));
        await atualizarUsuarioDaSessao(usuario);
      } catch {
        // Rede fora, servidor instável ou sessão já encerrada pelo aviso: nada a fazer aqui.
      }
    }

    void (async () => {
      let entrou: boolean;
      try {
        entrou = await restaurar();
      } finally {
        if (!cancelado) setRestaurando(false);
      }
      if (entrou) await revalidar();
    })().catch(() => undefined);

    return () => {
      cancelado = true;
      cancelarAviso();
    };
  }, [encerrarLocalmente]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await entrarComCredenciais(email, senha);
    exigirMontador(resposta);

    const tokens = { accessToken: resposta.accessToken, refreshToken: resposta.refreshToken };
    definirTokens(tokens);
    await salvarSessao({ ...tokens, usuario: resposta.usuario });
    setSessao({ usuario: resposta.usuario });
  }, []);

  const sair = useCallback(async () => {
    // Ordem deliberada: derruba a sessão local primeiro, para que a rede
    // lenta (ou ausente — o app é offline-first) nunca prenda o montador
    // numa tela da qual ele pediu para sair.
    const tokenDaSessao = lerTokenAtual();
    definirTokens(null);
    setSessao(null);
    await limparSessao();
    // Sem isto, um segundo montador que logar neste aparelho veria o
    // espelho de jornada do anterior até a primeira sincronização. `.catch`
    // porque uma falha aqui (ex.: adapter SQLite indisponível) não pode
    // impedir de chegar em `encerrarSessaoNoServidor` logo abaixo — `sair()`
    // é chamado como `void sair()` em `Jornada.tsx`, e uma rejeição não
    // tratada aqui viraria unhandled rejection.
    await limparBancoLocal().catch(() => undefined);
    if (tokenDaSessao) {
      await encerrarSessaoNoServidor(tokenDaSessao).catch(() => undefined);
    }
  }, []);

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
