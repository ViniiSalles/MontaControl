import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Perfil } from '@montacontrol/shared';
import type { LoginResponse, UsuarioDTO } from '@montacontrol/shared';
import {
  buscarUsuarioAtual,
  encerrarSessaoNoServidor,
  entrarComCredenciais,
  ErroAutenticacao,
} from './clienteAuth';
import {
  lerDonoDaFila,
  lerSessao,
  limparDonoDaFila,
  limparSessao,
  registrarDonoDaFila,
  salvarSessao,
} from './armazenamentoSessao';
import {
  aoSessaoExpirar,
  atualizarUsuarioDaSessao,
  comTokenRenovado,
  definirTokens,
  lerTokenAtual,
} from './tokenSessao';
import {
  contarAcoesNaFilaLocal,
  lerDonoNoBancoLocal,
  limparBancoLocal,
  limparEspelhoBancoLocal,
  registrarDonoNoBancoLocal,
} from '../db/database';
import { decidirDestinoDaFila } from './destinoDaFila';

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

/**
 * A fila de ações pendentes sobrevive à expiração forçada da sessão. No
 * login/boot seguinte, `decidirDestinoDaFila` compara o dono dela (gravado ao
 * lado da fila e no SecureStore) com quem autentica: sem prova de que é do
 * mesmo usuário — dono diferente, desconhecido, ilegível — apaga tudo; nunca
 * uma ação de um montador sai sob o token de outro. Roda ANTES de o token ser
 * liberado e falha fechado: se não der para apagar, o login não segue.
 * Depois, o dono da fila passa a ser quem autenticou.
 */
async function reconciliarFilaCom(usuario: UsuarioDTO): Promise<void> {
  const [acoes, donoBanco, donoMarcador] = await Promise.all([
    contarAcoesNaFilaLocal().catch(() => 'erro' as const),
    lerDonoNoBancoLocal(),
    lerDonoDaFila(),
  ]);

  if (
    decidirDestinoDaFila({ acoes, donoBanco, donoMarcador, usuarioId: usuario.id }) === 'apagar'
  ) {
    await limparBancoLocal();
  }
  // O marcador do SecureStore só existe entre a expiração forçada e este login.
  if (donoMarcador.tipo !== 'ausente') await limparDonoDaFila();
  await registrarDonoNoBancoLocal(usuario.id);
}

export function ProvedorAuth({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<SessaoAutenticada | null>(null);
  const [restaurando, setRestaurando] = useState(true);
  /** Quem está logado agora; permite descartar respostas de uma sessão que já acabou. */
  const usuarioIdRef = useRef<number | null>(null);

  /**
   * Fim da sessão local por perfil recusado: apaga tudo, fila inclusive, para
   * que o próximo montador a logar neste aparelho não veja nada do anterior.
   */
  const encerrarLocalmente = useCallback(async () => {
    usuarioIdRef.current = null;
    definirTokens(null);
    setSessao(null);
    await limparSessao();
    await limparBancoLocal().catch(() => undefined);
  }, []);

  /**
   * Expiração forçada (refresh recusado pelo servidor). As marcações de ponto
   * ainda não enviadas são do montador: a fila fica no aparelho, marcada com o
   * dono, e só a réplica do servidor é apagada. Sem conseguir marcar o dono
   * não há como preservar com segurança — apaga tudo.
   */
  const encerrarPorExpiracao = useCallback(async () => {
    const donoId = usuarioIdRef.current;
    if (donoId === null) return encerrarLocalmente();

    usuarioIdRef.current = null;
    definirTokens(null);
    setSessao(null);
    // Dono primeiro: um app fechado no meio nunca deixa fila sem dono.
    if (!(await registrarDonoDaFila(donoId))) {
      await limparSessao();
      await limparBancoLocal().catch(() => undefined);
      return;
    }
    await limparSessao();
    await limparEspelhoBancoLocal().catch(() => undefined);
  }, [encerrarLocalmente]);

  useEffect(() => {
    // `cancelado` evita `setState` depois do unmount caso o app seja fechado
    // no meio da restauração (a splash ainda está na tela aqui).
    let cancelado = false;

    // Refresh recusado durante a sessão (em qualquer chamada, não só no boot).
    const cancelarAviso = aoSessaoExpirar(encerrarPorExpiracao);

    /** Lê a sessão guardada e entra com ela na hora — sem rede, sem Login. Devolve o id do usuário, se entrou. */
    async function restaurar(): Promise<number | null> {
      const salva = await lerSessao();
      if (!salva) return null;

      if (salva.usuario.perfil !== Perfil.MONTADOR) {
        await encerrarLocalmente();
        return null;
      }

      await reconciliarFilaCom(salva.usuario);
      usuarioIdRef.current = salva.usuario.id;
      definirTokens({ accessToken: salva.accessToken, refreshToken: salva.refreshToken });
      if (!cancelado) setSessao({ usuario: salva.usuario });
      return salva.usuario.id;
    }

    /**
     * Segundo plano, depois de entrar: confere em `GET /auth/me` se a sessão
     * ainda vale (montador desativado, perfil trocado). 401 renova o token
     * (`comTokenRenovado`); refresh recusado encerra a sessão pelo aviso
     * registrado acima. Qualquer falha de rede mantém a sessão — é o caso
     * normal de quem abre o app numa obra sem sinal.
     */
    async function revalidar(usuarioId: number): Promise<void> {
      try {
        const usuario = await comTokenRenovado((token) => buscarUsuarioAtual(token));
        // A resposta é de uma sessão que já acabou (saiu, ou entrou outro): ignora.
        if (cancelado || usuarioIdRef.current !== usuarioId) return;

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
      let usuarioId: number | null;
      try {
        usuarioId = await restaurar();
      } finally {
        if (!cancelado) setRestaurando(false);
      }
      if (usuarioId !== null) await revalidar(usuarioId);
    })().catch(() => undefined);

    return () => {
      cancelado = true;
      cancelarAviso();
    };
  }, [encerrarLocalmente, encerrarPorExpiracao]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await entrarComCredenciais(email, senha);
    exigirMontador(resposta);
    await reconciliarFilaCom(resposta.usuario);

    const tokens = { accessToken: resposta.accessToken, refreshToken: resposta.refreshToken };
    usuarioIdRef.current = resposta.usuario.id;
    definirTokens(tokens);
    await salvarSessao({ ...tokens, usuario: resposta.usuario });
    setSessao({ usuario: resposta.usuario });
  }, []);

  const sair = useCallback(async () => {
    // Ordem deliberada: derruba a sessão local primeiro, para que a rede
    // lenta (ou ausente — o app é offline-first) nunca prenda o montador
    // numa tela da qual ele pediu para sair.
    const tokenDaSessao = lerTokenAtual();
    const donoId = usuarioIdRef.current;
    usuarioIdRef.current = null;
    definirTokens(null);
    setSessao(null);
    await limparSessao();
    // Sem isto, um segundo montador que logar neste aparelho veria o
    // espelho de jornada do anterior até a primeira sincronização. `.catch`
    // porque uma falha aqui (ex.: adapter SQLite indisponível) não pode
    // impedir de chegar em `encerrarSessaoNoServidor` logo abaixo — `sair()`
    // é chamado como `void sair()` em `Jornada.tsx`, e uma rejeição não
    // tratada aqui viraria unhandled rejection.
    const apagou = await limparBancoLocal().then(
      () => true,
      () => false,
    );
    // Logout explícito apaga tudo, fila e marcador de dono. Se o banco não
    // deixou apagar, marca o dono: o próximo login de outro usuário limpa.
    if (apagou) await limparDonoDaFila();
    else if (donoId !== null) await registrarDonoDaFila(donoId);
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
