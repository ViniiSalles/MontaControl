import { useCallback, useMemo } from 'react';
import { useConsulta } from '../db/useConsulta';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { useSincronizacaoStore } from '../estado/sincronizacaoStore';
import { sincronizar } from '../sincronizacao/syncManager';
import {
  COLUNAS_OBSERVADAS_DE_ACAO_DE_ATESTADO,
  COLUNAS_OBSERVADAS_DE_ATESTADO,
  montarAtestadosExibidos,
  paraAtestadoDaReplica,
  paraAtestadoNaFila,
  queryAcoesDeAtestado,
  queryAtestados,
} from './atestadosComPendentes';
import type { AtestadoExibido } from './atestadosComPendentes';

export interface EstadoMeusAtestados {
  atestados: AtestadoExibido[];
  /** `true` até a réplica e a fila terem emitido a primeira leitura. */
  carregando: boolean;
  /** A última sincronização falhou e não há nenhum atestado (nem na fila) para mostrar. */
  erro: boolean;
  /** Dispara uma sincronização e espera ela terminar. */
  recarregar: () => Promise<void>;
}

/**
 * Atestados do montador lidos da réplica local (a análise do RH chega pelo
 * pull), com os ainda na fila por cima (`aguardandoEnvio`); o do pull os
 * substitui pelo `idCliente`. Não vai à rede: quem sincroniza é o provider do
 * app, e `recarregar` só pede uma rodada.
 */
export function useMeusAtestados(): EstadoMeusAtestados {
  const database = useDatabaseOuFalha();
  const ultimoErro = useSincronizacaoStore((estado) => estado.ultimoErro);

  const replica = useConsulta(queryAtestados, COLUNAS_OBSERVADAS_DE_ATESTADO, paraAtestadoDaReplica);
  const acoes = useConsulta(
    queryAcoesDeAtestado,
    COLUNAS_OBSERVADAS_DE_ACAO_DE_ATESTADO,
    paraAtestadoNaFila,
  );

  const atestados = useMemo(
    () =>
      montarAtestadosExibidos({
        replica: replica ?? [],
        acoes: (acoes ?? []).flatMap((acao) => acao ?? []),
      }),
    [replica, acoes],
  );

  const carregando = replica === null || acoes === null;
  const recarregar = useCallback(() => sincronizar(database), [database]);

  return {
    atestados,
    carregando,
    erro: !carregando && ultimoErro !== null && atestados.length === 0,
    recarregar,
  };
}
