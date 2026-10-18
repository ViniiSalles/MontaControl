import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import { enviarAvaria } from '../avarias/clienteAvarias';
import { buscarBancoHoras } from '../banco-horas/clienteBancoHoras';
import { upsertBancoHoras } from '../banco-horas/espelhoBancoHoras';
import { periodoAtual } from '../banco-horas/periodo';
import {
  buscarHistorico,
  buscarJornadaAtual,
  enviarCheckin,
  enviarCheckout,
  enviarSolicitacaoPonto,
} from '../jornada/clienteJornadas';
import { reconciliarJornadaOtimista, upsertJornadas } from '../jornada/espelhoJornada';
import { AcaoPendente } from '../db/AcaoPendente';
import { ehRecusaDoServidor } from './outbox';
import type { JornadaDTO, PeriodoHistorico } from '@montacontrol/shared';

/**
 * Refaz o GET de jornada atual + histórico e grava no espelho local.
 * `periodo` default 5 dias — heartbeat razoável para as chamadas em segundo
 * plano (boot, volta de rede, retorno ao app); quem lê o histórico com um
 * período maior (`useHistoricoPontos`) repassa o período explicitamente,
 * senão o espelho local nunca é abastecido além de 5 dias. Propaga erro de
 * rede.
 */
export async function puxarJornadas(
  database: Database,
  periodo: PeriodoHistorico = 5,
): Promise<void> {
  const [atual, historico] = await Promise.all([buscarJornadaAtual(), buscarHistorico(periodo)]);
  const jornadasParaEspelhar = [
    ...(atual ? [atual] : []),
    ...historico.dias.flatMap((dia) => dia.jornadas),
  ];
  await upsertJornadas(database, jornadasParaEspelhar);
}

/** Refaz o GET de banco de horas do mes/ano pedido e grava no espelho local. Propaga erro de rede. */
export async function puxarBancoHoras(database: Database, mes: number, ano: number): Promise<void> {
  const bancoHoras = await buscarBancoHoras(mes, ano);
  await upsertBancoHoras(database, bancoHoras);
}

/**
 * `sem_rede` cobre tudo o que não é uma decisão do servidor sobre a ação:
 * falha de rede, 5xx e também 401 (token expirado, ver `ehRecusaDoServidor`).
 */
async function reenviar(
  acao: AcaoPendente,
): Promise<
  | { tipo: 'ok'; jornada: JornadaDTO | null }
  | { tipo: 'recusado'; codigo: string }
  | { tipo: 'sem_rede' }
> {
  const payload = JSON.parse(acao.payload);
  try {
    if (acao.tipo === 'checkin') return { tipo: 'ok', jornada: await enviarCheckin(payload) };
    if (acao.tipo === 'checkout') return { tipo: 'ok', jornada: await enviarCheckout(payload) };
    if (acao.tipo === 'avaria') {
      await enviarAvaria(payload);
      return { tipo: 'ok', jornada: null };
    }
    await enviarSolicitacaoPonto(payload);
    return { tipo: 'ok', jornada: null };
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) {
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    return { tipo: 'sem_rede' };
  }
}

/**
 * Processa a fila em ordem (FIFO) — importante porque um check-out depende
 * do check-in já ter sido aplicado no servidor. Recusa de regra de negócio
 * (4xx exceto 401/408/429) vira `descartada` e segue para o próximo; falha de
 * rede ou 401 (sessão a renovar) para a drenagem inteira, para não pular à
 * frente na ordem — a ação segue `pendente`. O token vem da fonte única
 * (`auth/tokenSessao`), buscado a cada chamada. Check-in/check-out bem
 * sucedidos reconciliam o registro otimista que `outbox.ts` (Task 5)
 * gravou ao enfileirar — sem isto, o `puxarJornadas` seguinte duplicaria a
 * jornada (o registro otimista tem `remoteId: null`, e o upsert por
 * `remote_id` não o encontraria).
 */
export async function drenarFila(database: Database): Promise<void> {
  const colecao = database.get<AcaoPendente>('acoes_pendentes');
  const pendentes = await colecao.query(Q.where('status', 'pendente')).fetch();
  const emOrdem = [...pendentes].sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));

  for (const acao of emOrdem) {
    const resultado = await reenviar(acao);

    if (resultado.tipo === 'ok') {
      if (resultado.jornada) {
        await reconciliarJornadaOtimista(database, acao.idCliente, resultado.jornada);
      }
      await database.write(() => acao.destroyPermanently());
    } else if (resultado.tipo === 'recusado') {
      await database.write(() =>
        acao.update((registro) => {
          registro.status = 'descartada';
          registro.mensagemDescarte = `Ação recusada: ${resultado.codigo}.`;
        }),
      );
    } else {
      break;
    }
  }
}

let emSincronizacao = false;

async function sincronizarUmaVez(database: Database): Promise<void> {
  if (emSincronizacao) return;
  emSincronizacao = true;
  try {
    await drenarFila(database);
    const { mes, ano } = periodoAtual(new Date().toISOString());
    await Promise.allSettled([
      puxarJornadas(database),
      puxarBancoHoras(database, mes, ano),
    ]);
  } finally {
    emSincronizacao = false;
  }
}

/**
 * Liga os gatilhos automáticos de sincronização (boot, volta de
 * conectividade, retorno ao primeiro plano). Chamado uma vez por
 * `ProvedorSincronizacao` (app autenticado), que guarda a função de limpeza
 * devolvida e a chama no logout.
 */
export function iniciarSincronizacao(database: Database): () => void {
  void sincronizarUmaVez(database);

  const removerListenerRede = NetInfo.addEventListener((estado) => {
    if (estado.isConnected && estado.isInternetReachable !== false) {
      void sincronizarUmaVez(database);
    }
  });

  const assinaturaAppState = AppState.addEventListener('change', (proximoEstado) => {
    if (proximoEstado === 'active') void sincronizarUmaVez(database);
  });

  return () => {
    removerListenerRede();
    assinaturaAppState.remove();
  };
}
