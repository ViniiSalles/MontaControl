import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import type { Database } from '@nozbe/watermelondb';
import { buscarBancoHoras } from '../banco-horas/clienteBancoHoras';
import { upsertBancoHoras } from '../banco-horas/espelhoBancoHoras';
import { periodoAtual } from '../banco-horas/periodo';
import {
  ErroApi,
  buscarHistorico,
  buscarJornadaAtual,
  enviarCheckin,
  enviarCheckout,
  enviarSolicitacaoPonto,
} from '../jornada/clienteJornadas';
import { reconciliarJornadaOtimista, upsertJornadas } from '../jornada/espelhoJornada';
import { AcaoPendente } from '../db/AcaoPendente';
import type { JornadaDTO } from '@montacontrol/shared';

/** Refaz o GET de jornada atual + histórico (5 dias) e grava no espelho local. Propaga erro de rede. */
export async function puxarJornadas(database: Database, token: string): Promise<void> {
  const [atual, historico] = await Promise.all([buscarJornadaAtual(token), buscarHistorico(token, 5)]);
  const jornadasParaEspelhar = [
    ...(atual ? [atual] : []),
    ...historico.dias.flatMap((dia) => dia.jornadas),
  ];
  await upsertJornadas(database, jornadasParaEspelhar);
}

/** Refaz o GET de banco de horas do mes/ano pedido e grava no espelho local. Propaga erro de rede. */
export async function puxarBancoHoras(
  database: Database,
  token: string,
  mes: number,
  ano: number,
): Promise<void> {
  const bancoHoras = await buscarBancoHoras(token, mes, ano);
  await upsertBancoHoras(database, bancoHoras);
}

async function reenviar(
  token: string,
  acao: AcaoPendente,
): Promise<
  | { tipo: 'ok'; jornada: JornadaDTO | null }
  | { tipo: 'recusado'; codigo: string }
  | { tipo: 'sem_rede' }
> {
  const payload = JSON.parse(acao.payload);
  try {
    if (acao.tipo === 'checkin') return { tipo: 'ok', jornada: await enviarCheckin(token, payload) };
    if (acao.tipo === 'checkout') return { tipo: 'ok', jornada: await enviarCheckout(token, payload) };
    await enviarSolicitacaoPonto(token, payload);
    return { tipo: 'ok', jornada: null };
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) {
      return { tipo: 'recusado', codigo: erro.codigo };
    }
    return { tipo: 'sem_rede' };
  }
}

/**
 * Processa a fila em ordem (FIFO) — importante porque um check-out depende
 * do check-in já ter sido aplicado no servidor. Recusa (4xx) vira
 * `descartada` e segue para o próximo; falha de rede para a drenagem
 * inteira, para não pular à frente na ordem. Check-in/check-out bem
 * sucedidos reconciliam o registro otimista que `outbox.ts` (Task 5)
 * gravou ao enfileirar — sem isto, o `puxarJornadas` seguinte duplicaria a
 * jornada (o registro otimista tem `remoteId: null`, e o upsert por
 * `remote_id` não o encontraria).
 */
export async function drenarFila(database: Database, token: string): Promise<void> {
  const colecao = database.get<AcaoPendente>('acoes_pendentes');
  const pendentes = await colecao.query(Q.where('status', 'pendente')).fetch();
  const emOrdem = [...pendentes].sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1));

  for (const acao of emOrdem) {
    const resultado = await reenviar(token, acao);

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

async function sincronizarUmaVez(database: Database, token: string): Promise<void> {
  if (emSincronizacao) return;
  emSincronizacao = true;
  try {
    await drenarFila(database, token);
    const { mes, ano } = periodoAtual(new Date().toISOString());
    await Promise.allSettled([
      puxarJornadas(database, token),
      puxarBancoHoras(database, token, mes, ano),
    ]);
  } finally {
    emSincronizacao = false;
  }
}

/**
 * Liga os gatilhos automáticos de sincronização (boot, volta de
 * conectividade, retorno ao primeiro plano). Chamado uma vez em `App.tsx`;
 * devolve uma função de limpeza.
 */
export function iniciarSincronizacao(database: Database, token: string): () => void {
  void sincronizarUmaVez(database, token);

  const removerListenerRede = NetInfo.addEventListener((estado) => {
    if (estado.isConnected && estado.isInternetReachable !== false) {
      void sincronizarUmaVez(database, token);
    }
  });

  const assinaturaAppState = AppState.addEventListener('change', (proximoEstado) => {
    if (proximoEstado === 'active') void sincronizarUmaVez(database, token);
  });

  return () => {
    removerListenerRede();
    assinaturaAppState.remove();
  };
}
