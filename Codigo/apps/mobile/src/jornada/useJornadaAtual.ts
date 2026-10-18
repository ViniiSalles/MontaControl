import { useCallback } from 'react';
import { diaNoFuso, StatusJornada } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../config/fuso';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { sincronizar } from '../sincronizacao/syncManager';
import { useStatusDaSincronizacao } from '../sincronizacao/statusDaSincronizacao';
import type { JornadaExibida } from './jornadasComPendentes';
import { useJornadasComPendentes } from './useJornadasComPendentes';

export interface EstadoJornadaAtual {
  /** A jornada em andamento ou, se não há, a última encerrada hoje; `null` sem nenhuma. */
  jornada: JornadaExibida | null;
  carregando: boolean;
  /** A última sincronização falhou e não há nenhuma jornada local (nem na fila) para mostrar. */
  erro: boolean;
  /** Dispara uma sincronização e espera ela (e a repetição de gatilhos que chegaram no meio) terminar. */
  recarregar: () => Promise<void>;
}

/** Jornada em andamento mais recente, ou `null`. */
export function jornadaEmAndamento(jornadas: readonly JornadaExibida[]): JornadaExibida | null {
  let atual: JornadaExibida | null = null;
  for (const jornada of jornadas) {
    if (jornada.status !== StatusJornada.EM_ANDAMENTO) continue;
    if (atual === null || (jornada.checkinAt ?? '') > (atual.checkinAt ?? '')) atual = jornada;
  }
  return atual;
}

/**
 * O que a tela de ponto mostra: a jornada em andamento e, sem ela, o último
 * turno encerrado hoje (dia civil no fuso de operação) — é isso que mantém o
 * ponto recém-batido na tela depois do check-out.
 */
export function jornadaParaExibir(
  jornadas: readonly JornadaExibida[],
  agoraIso: string,
): JornadaExibida | null {
  const aberta = jornadaEmAndamento(jornadas);
  if (aberta) return aberta;

  const hoje = diaNoFuso(agoraIso, FUSO_OPERACAO);
  let ultima: JornadaExibida | null = null;
  let instanteDaUltima = '';
  for (const jornada of jornadas) {
    const instante = jornada.checkoutAt ?? jornada.checkinAt;
    if (!instante || diaNoFuso(instante, FUSO_OPERACAO) !== hoje) continue;
    if (instante > instanteDaUltima) {
      ultima = jornada;
      instanteDaUltima = instante;
    }
  }
  return ultima;
}

/**
 * Jornada do montador para a tela de ponto: réplica + ações na fila por cima.
 * Só lê o banco local; a sincronização é do provider do app, e `recarregar`
 * apenas pede uma.
 */
export function useJornadaAtual(): EstadoJornadaAtual {
  const database = useDatabaseOuFalha();
  const { jornadas, carregando } = useJornadasComPendentes();
  const { ultimoErro } = useStatusDaSincronizacao();

  // Barato (dezenas de linhas) e depende do relógio: calculado a cada render,
  // sem memo, para virar o dia sem esperar uma mudança no banco.
  const jornada = jornadaParaExibir(jornadas, new Date().toISOString());
  const recarregar = useCallback(() => sincronizar(database), [database]);

  return {
    jornada,
    carregando,
    erro: !carregando && ultimoErro !== null && jornadas.length === 0,
    recarregar,
  };
}
