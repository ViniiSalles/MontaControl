import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
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
import {
  descartarEstadosDaReplica,
  descartarEstadosDoUsuario,
  reidratarEstadosPersistidos,
} from '../estado/estadosDoUsuario';
import { useSessaoStore } from '../estado/sessaoStore';

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

interface AcoesDeAuth {
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

interface ContextoAuth extends AcoesDeAuth {
  /** `null` = sem sessão. Durante a restauração de boot é `null` com `restaurando = true`. */
  sessao: SessaoAutenticada | null;
  /** Verdadeiro só até a sessão guardada ser lida — segura a splash. Nunca espera a rede. */
  restaurando: boolean;
}

/**
 * O estado da sessão (usuário, restaurando) mora em `useSessaoStore`; o
 * contexto só entrega as ações (`entrar`/`sair`), que dependem de refs e
 * callbacks do provider e são estáveis — mudar a sessão não re-renderiza quem
 * só chama as ações.
 */
const AcoesDeAuthContext = createContext<AcoesDeAuth | null>(null);

function publicarUsuario(usuario: UsuarioDTO | null): void {
  useSessaoStore.setState({ usuario });
}

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
 *
 * INVARIANTE: após qualquer autenticação bem-sucedida, o dono gravado no banco
 * é o usuário autenticado. Por isso gravar o dono é FATAL (lança antes de
 * liberar o token): um dono velho (X) prevalece sobre o marcador (regra de
 * `decidirDestinoDaFila`) e a fila de Y sairia com o token de X.
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
    // Obra e rascunho do usuário anterior também saem da memória (a expiração
    // forçada os manteve) e do disco, antes de qualquer hidratação.
    const descarte = descartarEstadosDoUsuario();
    await limparBancoLocal();
    await descarte;
  }
  if (!(await registrarDonoNoBancoLocal(usuario.id))) {
    throw new Error('Não foi possível registrar o dono da fila no aparelho.');
  }
  // O marcador do SecureStore só existe entre a expiração forçada e este login.
  if (donoMarcador.tipo !== 'ausente') await limparDonoDaFila();
  // Só agora o aparelho é comprovadamente deste usuário: lê do disco a obra
  // escolhida, o rascunho e a última sincronização (antes disso poderiam ser de outro).
  await reidratarEstadosPersistidos();
}

export function ProvedorAuth({ children }: { children: ReactNode }) {
  /** Quem está logado agora; permite descartar respostas de uma sessão que já acabou. */
  const usuarioIdRef = useRef<number | null>(null);

  /**
   * Fim da sessão local por perfil recusado: apaga tudo, fila inclusive, para
   * que o próximo montador a logar neste aparelho não veja nada do anterior.
   */
  const encerrarLocalmente = useCallback(async () => {
    usuarioIdRef.current = null;
    definirTokens(null);
    publicarUsuario(null);
    const descarte = descartarEstadosDoUsuario();
    await limparSessao();
    await limparBancoLocal().catch(() => undefined);
    await descarte;
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
    publicarUsuario(null);
    // Dono primeiro: um app fechado no meio nunca deixa fila sem dono.
    if (!(await registrarDonoDaFila(donoId))) {
      const descarte = descartarEstadosDoUsuario();
      await limparSessao();
      await limparBancoLocal().catch(() => undefined);
      await descarte;
      return;
    }
    // Fila e dono ficam, então obra e rascunho do mesmo montador também; só o
    // status da sincronização (que descreve a réplica apagada) vai embora.
    const descarteDaReplica = descartarEstadosDaReplica();
    await limparSessao();
    await limparEspelhoBancoLocal().catch(() => undefined);
    await descarteDaReplica;
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
      if (!cancelado) publicarUsuario(salva.usuario);
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
        useSessaoStore.setState((atual) => (atual.usuario ? { usuario } : atual));
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
        if (!cancelado) useSessaoStore.setState({ restaurando: false });
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
    publicarUsuario(resposta.usuario);
  }, []);

  const sair = useCallback(async () => {
    // Ordem deliberada: derruba a sessão local primeiro, para que a rede
    // lenta (ou ausente — o app é offline-first) nunca prenda o montador
    // numa tela da qual ele pediu para sair.
    const tokenDaSessao = lerTokenAtual();
    const donoId = usuarioIdRef.current;
    usuarioIdRef.current = null;
    definirTokens(null);
    publicarUsuario(null);
    // Obra, rascunho e status somem da memória já (síncrono); o disco é apagado abaixo.
    const descarte = descartarEstadosDoUsuario();
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
    await descarte;
    if (tokenDaSessao) {
      await encerrarSessaoNoServidor(tokenDaSessao).catch(() => undefined);
    }
  }, []);

  const acoes = useMemo(() => ({ entrar, sair }), [entrar, sair]);

  return <AcoesDeAuthContext.Provider value={acoes}>{children}</AcoesDeAuthContext.Provider>;
}

/**
 * Fatia fina sobre `useSessaoStore`: mantém o formato de antes
 * (`sessao`, `restaurando`, `entrar`, `sair`) para as telas. Quem só precisa do
 * usuário pode ler o store por seletor e não re-renderizar com o resto.
 */
export function useAuth(): ContextoAuth {
  const usuario = useSessaoStore((estado) => estado.usuario);
  const restaurando = useSessaoStore((estado) => estado.restaurando);
  const acoes = useContext(AcoesDeAuthContext);
  if (!acoes) throw new Error('useAuth deve ser usado dentro de <ProvedorAuth>');

  return useMemo(
    () => ({ sessao: usuario ? { usuario } : null, restaurando, ...acoes }),
    [usuario, restaurando, acoes],
  );
}
