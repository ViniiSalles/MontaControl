import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { enviarAtestado } from '../atestados/clienteAtestados';
import { enviarAvaria } from '../avarias/clienteAvarias';
import { enviarConferencia } from '../conferencia/clienteConferencia';
import { enviarCheckin, enviarCheckout, enviarSolicitacaoPonto } from '../jornada/clienteJornadas';
import { ErroSessaoExpirada, geracaoDaSessao, lerTokenAtual } from '../auth/tokenSessao';
import { AcaoPendente } from '../db/AcaoPendente';
import { ErroApi } from '../http/erroApi';
import { ehRecusaDoServidor } from './outbox';
import {
  apagarFotosDaAcao,
  caminhosDasFotosDaAcao,
  CODIGO_ATESTADO_SEM_FOTOS,
  MENSAGEM_ATESTADO_SEM_FOTOS,
  montarCorpoAtestado,
  montarCorpoAvaria,
} from './payloadsDaFila';
import { puxarMudancas } from './pullChanges';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import type { EstadoDaSincronizacao, ErroDeSincronizacao } from '../estado/sincronizacaoStore';

/**
 * Versão do schema local em que a sincronização por `synchronize()` passou a
 * existir. A migração do WatermelonDB (`migrationsEnabledAtVersion`) só é
 * usada a partir dela; o servidor não conhece a versão do schema local, só a
 * do contrato (`SYNC_SCHEMA_VERSION`).
 */
const VERSAO_INICIAL_DA_SINCRONIZACAO = 2;

/**
 * Ações cujo resultado aparece na tela como registro da réplica (jornada,
 * avaria, atestado, peça conferida): aceitas, ficam `enviada` até o pull o
 * trazer. O ponto em atraso não tem registro para sobrepor e sai da fila.
 */
const TIPOS_QUE_AGUARDAM_O_PULL = ['checkin', 'checkout', 'avaria', 'atestado', 'conferencia'];

/**
 * `sem_rede` cobre tudo o que não é uma decisão do servidor sobre a ação:
 * falha de rede, 5xx e também 401 (token expirado, ver `ehRecusaDoServidor`).
 */
async function reenviar(
  acao: AcaoPendente,
  geracao: number,
): Promise<
  { tipo: 'ok' } | { tipo: 'recusado'; codigo: string; mensagem?: string } | { tipo: 'sem_rede' }
> {
  const payload = JSON.parse(acao.payload);
  try {
    if (acao.tipo === 'checkin') await enviarCheckin(payload, { geracao });
    else if (acao.tipo === 'checkout') await enviarCheckout(payload, { geracao });
    else if (acao.tipo === 'conferencia') await enviarConferencia(payload, { geracao });
    else if (acao.tipo === 'avaria') {
      await enviarAvaria(await montarCorpoAvaria(payload), { geracao });
    } else if (acao.tipo === 'atestado') {
      const corpo = await montarCorpoAtestado(payload);
      // Sem nenhuma foto o servidor recusaria; as fotos não voltam, então nem tenta.
      if (corpo === null) {
        return {
          tipo: 'recusado',
          codigo: CODIGO_ATESTADO_SEM_FOTOS,
          mensagem: MENSAGEM_ATESTADO_SEM_FOTOS,
        };
      }
      await enviarAtestado(corpo, { geracao });
    } else await enviarSolicitacaoPonto(payload, { geracao });
    return { tipo: 'ok' };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      return {
        tipo: 'recusado',
        codigo: erro.codigo,
        mensagem: mensagemDeRecusa(acao.tipo, erro),
      };
    }
    return { tipo: 'sem_rede' };
  }
}

/**
 * Avaria, atestado e leitura de peça são ações do próprio montador, que já saiu da tela: o aviso
 * leva o texto do servidor (o motivo). Ponto segue com o código, como antes.
 */
function mensagemDeRecusa(tipo: string, erro: ErroApi): string | undefined {
  if (tipo === 'avaria') return `Avaria recusada: ${erro.message}`;
  if (tipo === 'atestado') return `Atestado recusado: ${erro.message}`;
  if (tipo === 'conferencia') return `Leitura de peça recusada: ${erro.message}`;
  return undefined;
}

/**
 * Processa a fila em ordem (FIFO) — importante porque um check-out depende
 * do check-in já ter sido aplicado no servidor. Recusa de regra de negócio
 * (4xx exceto 401/408/429) vira `descartada` e segue para o próximo; falha de
 * rede ou 401 (sessão a renovar) para a drenagem inteira, para não pular à
 * frente na ordem — a ação segue `pendente`. O token vem da fonte única
 * (`auth/tokenSessao`), buscado a cada chamada.
 *
 * Check-in/check-out, avaria e atestado aceitos viram `enviada` (não são
 * apagados): o registro só entra na réplica no pull seguinte, e até lá a
 * sobreposição precisa da ação para a tela não perdê-lo — se o pull falhar logo
 * depois do envio, o montador não pode ver o ponto (ou o atestado) sumir e
 * enviar de novo. O ponto em atraso não tem registro para sobrepor e sai da fila.
 */
export async function drenarFila(database: Database): Promise<void> {
  // A fila é lida e enviada aos poucos; se a sessão trocar no meio (sair/expirar
  // e outro usuário entrar), nada mais sai — as ações restantes são do usuário
  // anterior e jamais podem ir com o token do novo. A geração é capturada ANTES
  // de qualquer await.
  const geracao = geracaoDaSessao();
  const colecao = database.get<AcaoPendente>('acoes_pendentes');
  const pendentes = await colecao.query(Q.where('status', 'pendente')).fetch();
  const emOrdem = [...pendentes].sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));

  for (const acao of emOrdem) {
    if (geracaoDaSessao() !== geracao) break;
    // A lista foi lida antes do laço: o envio imediato de uma tela pode ter
    // confirmado (`enviada`) ou recusado (apagada) esta linha enquanto as
    // anteriores subiam. Reenviá-la seria um POST à toa (ou uma escrita em
    // registro apagado); só segue quem AINDA está pendente no banco.
    const aindaPendente = await colecao
      .query(Q.where('id', acao.id), Q.where('status', 'pendente'))
      .fetchCount();
    if (aindaPendente === 0) continue;
    const resultado = await reenviar(acao, geracao);
    // Sessão trocada durante a requisição: não grava nada com o resultado dela
    // (o banco já pode ser de outro usuário). A ação segue pendente; se o dono
    // voltar, o reenvio é idempotente por `idCliente`.
    if (geracaoDaSessao() !== geracao) break;

    if (resultado.tipo === 'ok') {
      const aguardaOPull = TIPOS_QUE_AGUARDAM_O_PULL.includes(acao.tipo);
      await database.write(async () => {
        if (aguardaOPull) {
          await acao.update((registro) => {
            registro.status = 'enviada';
          });
        } else {
          await acao.destroyPermanently();
        }
      });
      // Só depois de a ação sair da fila: se o app morrer aqui sobra um arquivo
      // órfão (apagado no logout), nunca uma ação pendente sem a foto.
      await apagarFotosDaAcao(caminhosDasFotosDaAcao(acao.payload));
    } else if (resultado.tipo === 'recusado') {
      await database.write(() =>
        acao.update((registro) => {
          registro.status = 'descartada';
          registro.mensagemDescarte = resultado.mensagem ?? `Ação recusada: ${resultado.codigo}.`;
        }),
      );
      await apagarFotosDaAcao(caminhosDasFotosDaAcao(acao.payload));
    } else {
      break;
    }
  }
}

/** Ids das ações `enviada` agora: o pull que vem a seguir já cobre todas elas. */
async function idsDasEnviadas(database: Database): Promise<string[]> {
  const enviadas = await database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('status', 'enviada'))
    .fetch();
  return enviadas.map((acao) => acao.id);
}

async function apagarEnviadas(database: Database, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const aindaNaFila = await database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('id', Q.oneOf(ids)), Q.where('status', 'enviada'))
    .fetch();
  if (aindaNaFila.length === 0) return;
  await database.write(() =>
    database.batch(...aindaNaFila.map((acao) => acao.prepareDestroyPermanently())),
  );
}

function classificarErro(erro: unknown): ErroDeSincronizacao {
  if (erro instanceof ErroSessaoExpirada) return 'sessao';
  if (erro instanceof ErroApi) {
    if (erro.status === 426 || erro.codigo === 'VERSAO_SCHEMA_INCOMPATIVEL') {
      return 'versao_incompativel';
    }
    if (erro.status === 401) return 'sessao';
    if (erro.status >= 500 || erro.status === 408 || erro.status === 429) return 'sem_rede';
    return 'falha';
  }
  // `fetch` rejeita com TypeError quando não há conexão.
  if (erro instanceof TypeError) return 'sem_rede';
  return 'falha';
}

/** O syncManager roda fora do React: publica no store por `setState`, sem passar por componente. */
function publicarStatus(parcial: Partial<EstadoDaSincronizacao>): void {
  useSincronizacaoStore.setState(parcial);
}

let execucoesAtivas = 0;

/**
 * Uma rodada completa: drena a fila (único caminho de envio) e baixa a réplica
 * com o `synchronize()` do WatermelonDB. Nunca rejeita — o desfecho vai para
 * o store de sincronização (a tela mostra erro só se não houver dado local).
 *
 * `pushChanges` fica vazio de propósito: as tabelas da réplica não recebem
 * escrita local, então não há o que enviar por ali.
 *
 * Segurança entre sessões: a geração é capturada ANTES de qualquer await e
 * conferida (1) na resposta do pull (`puxarMudancas`) e (2) logo antes de
 * aplicar (`onWillApplyRemoteChanges`). O wipe completo do logout é coberto
 * pelo próprio WatermelonDB (`ensureSameDatabase`): o `unsafeResetDatabase`
 * aborta a escrita do pull em curso.
 */
export async function executarSincronizacao(database: Database): Promise<void> {
  if (lerTokenAtual() === null) return;

  const geracao = geracaoDaSessao();
  const aindaEhASessao = () => geracaoDaSessao() === geracao;

  execucoesAtivas += 1;
  publicarStatus({ sincronizando: true });
  try {
    await drenarFila(database);
    if (!aindaEhASessao()) throw new ErroSessaoExpirada();

    const enviadasAntesDoPull = await idsDasEnviadas(database);
    await synchronize({
      database,
      pullChanges: ({ lastPulledAt, migration }) =>
        puxarMudancas(lastPulledAt ?? null, geracao, migration),
      onWillApplyRemoteChanges: async () => {
        if (!aindaEhASessao()) throw new ErroSessaoExpirada();
      },
      // Vazio de propósito: a réplica não recebe escrita local. O synchronize()
      // ainda roda a fase de push local (ele a executa sempre que `pushChanges`
      // existe) e marca como sincronizadas as linhas locais não sincronizadas —
      // aqui, as de `acoes_pendentes` (escrita inofensiva: a fila não usa o
      // `_status` do WatermelonDB, e esses estados não são lidos em lugar nenhum).
      pushChanges: async () => {},
      sendCreatedAsUpdated: true,
      migrationsEnabledAtVersion: VERSAO_INICIAL_DA_SINCRONIZACAO,
    });

    if (!aindaEhASessao()) return;
    await apagarEnviadas(database, enviadasAntesDoPull);
    publicarStatus({ ultimoErro: null, ultimaSincronizacaoEm: Date.now() });
  } catch (erro) {
    // O erro de uma sessão que já acabou não é da sessão atual.
    if (aindaEhASessao()) publicarStatus({ ultimoErro: classificarErro(erro) });
  } finally {
    execucoesAtivas -= 1;
    publicarStatus({ sincronizando: execucoesAtivas > 0 });
  }
}

interface Execucao {
  geracao: number;
  /** Um gatilho chegou com a rodada em curso: roda de novo quando ela terminar. */
  reexecutar: boolean;
  promessa: Promise<void>;
}

let execucaoAtual: Execucao | null = null;

/**
 * Dispara uma sincronização. Se já há uma rodada da MESMA sessão em curso, o
 * gatilho não se perde: marca para repetir assim que ela terminar (os dados
 * podem ter mudado depois do ponto em que o pull da rodada em curso foi
 * pedido) e devolve a promessa da execução inteira.
 *
 * Uma rodada de OUTRA sessão (logout/login com a rodada antiga ainda
 * pendurada na rede) não segura a nova: ela já vai abortar na conferência de
 * geração e não pode atrasar nem esconder o gatilho do usuário que entrou.
 */
export function sincronizar(database: Database): Promise<void> {
  const geracao = geracaoDaSessao();
  if (execucaoAtual && execucaoAtual.geracao === geracao) {
    execucaoAtual.reexecutar = true;
    return execucaoAtual.promessa;
  }

  const execucao = { geracao, reexecutar: false } as Execucao;
  execucaoAtual = execucao;
  execucao.promessa = (async () => {
    try {
      do {
        execucao.reexecutar = false;
        await executarSincronizacao(database);
      } while (execucao.reexecutar);
    } finally {
      if (execucaoAtual === execucao) execucaoAtual = null;
    }
  })();
  return execucao.promessa;
}

/**
 * Liga os gatilhos automáticos de sincronização (boot, volta de
 * conectividade, retorno ao primeiro plano). Chamado uma vez por
 * `useSincronizacaoDoApp` (app autenticado), que guarda a função de limpeza
 * devolvida e a chama no logout. Também publica `online` no store.
 */
export function iniciarSincronizacao(database: Database): () => void {
  void sincronizar(database);

  const removerListenerRede = NetInfo.addEventListener((estado) => {
    // `isConnected` nulo = ainda desconhecido: não declara offline à toa.
    publicarStatus({
      online: estado.isConnected !== false && estado.isInternetReachable !== false,
    });
    if (estado.isConnected && estado.isInternetReachable !== false) {
      void sincronizar(database);
    }
  });

  const assinaturaAppState = AppState.addEventListener('change', (proximoEstado) => {
    if (proximoEstado === 'active') void sincronizar(database);
  });

  return () => {
    removerListenerRede();
    assinaturaAppState.remove();
    // Logout: um gatilho que ficou para repetir era da sessão que acabou.
    if (execucaoAtual) execucaoAtual.reexecutar = false;
    useSincronizacaoStore.getState().reiniciar();
  };
}
