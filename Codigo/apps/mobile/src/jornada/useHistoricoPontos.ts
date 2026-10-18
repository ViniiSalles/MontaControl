import { useCallback, useMemo } from 'react';
import type { DiaJornadaDTO, PeriodoHistorico } from '@montacontrol/shared';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { sincronizar } from '../sincronizacao/syncManager';
import { useStatusDaSincronizacao } from '../sincronizacao/statusDaSincronizacao';
import { construirHistoricoDTO, jornadasNoPeriodo } from './espelhoJornada';
import { useJornadasComPendentes } from './useJornadasComPendentes';

export interface EstadoHistorico {
  dias: DiaJornadaDTO[];
  totalMinutos: number;
  carregando: boolean;
  /** A última sincronização falhou e não há nenhum ponto local no período. */
  erro: boolean;
  /** Dispara uma sincronização e espera ela terminar. */
  recarregar: () => Promise<void>;
}

/**
 * Histórico de pontos do período escolhido: réplica + ações na fila por cima.
 * Só lê o banco local — o pull do app traz a janela de 30 dias (a maior do
 * seletor), então trocar de período não precisa de rede.
 */
export function useHistoricoPontos(periodo: PeriodoHistorico): EstadoHistorico {
  const database = useDatabaseOuFalha();
  const { jornadas, carregando } = useJornadasComPendentes();
  const { ultimoErro } = useStatusDaSincronizacao();

  const historico = useMemo(() => {
    const agoraIso = new Date().toISOString();
    return construirHistoricoDTO(jornadasNoPeriodo(jornadas, periodo, agoraIso), periodo, agoraIso);
  }, [jornadas, periodo]);

  const recarregar = useCallback(() => sincronizar(database), [database]);

  return {
    dias: historico.dias,
    totalMinutos: historico.totalMinutos,
    carregando,
    erro: !carregando && ultimoErro !== null && historico.dias.length === 0,
    recarregar,
  };
}
