import { useCallback, useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import type { PedidoDoMontadorDTO } from '@montacontrol/shared';
import { AcaoPendente } from '../db/AcaoPendente';
import { useConsulta } from '../db/useConsulta';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import {
  COLUNAS_OBSERVADAS_DE_AMBIENTE,
  COLUNAS_OBSERVADAS_DE_PECA,
  COLUNAS_OBSERVADAS_DE_PEDIDO_COMPLETO,
  montarPedidosDoMontador,
  paraAmbienteDoMontador,
  paraPecaDoMontador,
  paraPedidoDoMontador,
  queryAmbientesDoMontador,
  queryPecasDoMontador,
  queryPedidosDoMontador,
} from '../pedidos/pedidosDoMontador';
import { sincronizar } from '../sincronizacao/syncManager';
import type { LeituraNaFila } from './conferencia';

export interface EstadoDadosConferencia {
  pedidos: PedidoDoMontadorDTO[];
  /** Leituras ainda na fila — o checklist as mostra conferidas por cima da réplica. */
  leiturasNaFila: LeituraNaFila[];
  /** `true` até a réplica e a fila terem emitido a primeira leitura. */
  carregando: boolean;
  /** A última sincronização falhou e não há nenhum pedido no aparelho. */
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** `pendente` → `enviada` não tira a leitura da sobreposição; só o pull seguinte a apaga. */
const COLUNAS_OBSERVADAS_DE_ACAO = ['status'];

function queryLeiturasNaFila(database: Database): Query<AcaoPendente> {
  return database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('tipo', 'conferencia'), Q.where('status', Q.oneOf(['pendente', 'enviada'])));
}

/** Payload ilegível não derruba a tela: a linha só fica de fora da sobreposição. */
function paraLeituraNaFila(acao: AcaoPendente): LeituraNaFila | null {
  try {
    const { pedidoId, codigoBarras } = JSON.parse(acao.payload) as LeituraNaFila;
    return typeof pedidoId === 'number' && typeof codigoBarras === 'string'
      ? { pedidoId, codigoBarras }
      : null;
  } catch {
    return null;
  }
}

/**
 * Pedidos do montador (com ambientes e peças) e as leituras ainda na fila,
 * tudo da réplica local — a bipagem funciona sem sinal (N4T3). Não vai à
 * rede: quem sincroniza é o provider do app; `recarregar` só pede uma rodada.
 */
export function useDadosConferencia(): EstadoDadosConferencia {
  const database = useDatabaseOuFalha();
  const ultimoErro = useSincronizacaoStore((estado) => estado.ultimoErro);

  const pedidos = useConsulta(queryPedidosDoMontador, COLUNAS_OBSERVADAS_DE_PEDIDO_COMPLETO, paraPedidoDoMontador);
  const ambientes = useConsulta(queryAmbientesDoMontador, COLUNAS_OBSERVADAS_DE_AMBIENTE, paraAmbienteDoMontador);
  const pecas = useConsulta(queryPecasDoMontador, COLUNAS_OBSERVADAS_DE_PECA, paraPecaDoMontador);
  const acoes = useConsulta(queryLeiturasNaFila, COLUNAS_OBSERVADAS_DE_ACAO, paraLeituraNaFila);

  const pedidosCompletos = useMemo(
    () => montarPedidosDoMontador(pedidos ?? [], ambientes ?? [], pecas ?? []),
    [pedidos, ambientes, pecas],
  );
  const leiturasNaFila = useMemo(
    () => (acoes ?? []).flatMap((leitura) => leitura ?? []),
    [acoes],
  );

  const carregando = [pedidos, ambientes, pecas, acoes].some((leitura) => leitura === null);
  const recarregar = useCallback(() => sincronizar(database), [database]);

  return {
    pedidos: pedidosCompletos,
    leiturasNaFila,
    carregando,
    erro: !carregando && ultimoErro !== null && pedidosCompletos.length === 0,
    recarregar,
  };
}
