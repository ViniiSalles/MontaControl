import { useSyncExternalStore } from 'react';

/**
 * Por que a última sincronização não completou:
 * - `versao_incompativel`: o servidor (426) não aceita mais esta versão do app — só atualizar resolve;
 * - `sem_rede`: falha de conexão, timeout ou 5xx — tenta de novo no próximo gatilho;
 * - `sessao`: sem sessão ou ela trocou/expirou durante a execução;
 * - `falha`: qualquer outro erro (resposta inesperada, banco local).
 */
export type ErroDeSincronizacao = 'versao_incompativel' | 'sem_rede' | 'sessao' | 'falha';

export interface StatusDaSincronizacao {
  sincronizando: boolean;
  /** `null` depois de uma execução bem-sucedida. */
  ultimoErro: ErroDeSincronizacao | null;
  /** Instante (ms) do fim do último pull aplicado, nesta execução do app. */
  ultimaSincronizacaoEm: number | null;
}

const STATUS_INICIAL: StatusDaSincronizacao = {
  sincronizando: false,
  ultimoErro: null,
  ultimaSincronizacaoEm: null,
};

type Ouvinte = () => void;

let status: StatusDaSincronizacao = STATUS_INICIAL;
const ouvintes = new Set<Ouvinte>();

/**
 * Status em módulo (fora do React): o `syncManager` o atualiza sem árvore de
 * componentes e qualquer tela o lê por `useStatusDaSincronizacao`. Provisório:
 * a issue de estado global (#114) leva isto para o store de sincronização.
 */
export function lerStatusDaSincronizacao(): StatusDaSincronizacao {
  return status;
}

export function atualizarStatusDaSincronizacao(parcial: Partial<StatusDaSincronizacao>): void {
  status = { ...status, ...parcial };
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function assinarStatusDaSincronizacao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Volta ao estado inicial — no logout e entre testes. */
export function reiniciarStatusDaSincronizacao(): void {
  atualizarStatusDaSincronizacao(STATUS_INICIAL);
}

export function useStatusDaSincronizacao(): StatusDaSincronizacao {
  return useSyncExternalStore(assinarStatusDaSincronizacao, lerStatusDaSincronizacao);
}
