import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { database } from '../db/database';
import { armazenamentoDoBanco } from './armazenamentoDoBanco';
import { CHAVE_SINCRONIZACAO } from './chavesPersistidas';

/**
 * Por que a última sincronização não completou:
 * - `versao_incompativel`: o servidor (426) não aceita mais esta versão do app — só atualizar resolve;
 * - `sem_rede`: falha de conexão, timeout ou 5xx — tenta de novo no próximo gatilho;
 * - `sessao`: sem sessão ou ela trocou/expirou durante a execução;
 * - `falha`: qualquer outro erro (resposta inesperada, banco local).
 */
export type ErroDeSincronizacao = 'versao_incompativel' | 'sem_rede' | 'sessao' | 'falha';

export interface EstadoDaSincronizacao {
  /** Há conexão com a internet (NetInfo). Otimista até o primeiro evento. */
  online: boolean;
  sincronizando: boolean;
  /** Ações na fila ainda não confirmadas pelo servidor (a fila em si mora no WatermelonDB). */
  pendentes: number;
  /** Instante (ms) do fim do último pull aplicado. Único campo persistido. */
  ultimaSincronizacaoEm: number | null;
  /** `null` depois de uma execução bem-sucedida. */
  ultimoErro: ErroDeSincronizacao | null;
  /** Mensagens das ações que o servidor recusou; a ação já saiu da fila. */
  avisosDescartados: string[];
}

export interface AcoesDaSincronizacao {
  /** Esconde os avisos já lidos. */
  dispensarAvisos: () => void;
  /** Volta ao estado inicial (logout, fim da sincronização do app). */
  reiniciar: () => void;
}

export const ESTADO_INICIAL_DA_SINCRONIZACAO: EstadoDaSincronizacao = {
  online: true,
  sincronizando: false,
  pendentes: 0,
  ultimaSincronizacaoEm: null,
  ultimoErro: null,
  avisosDescartados: [],
};

interface EstadoPersistido {
  ultimaSincronizacaoEm: number | null;
}

/**
 * Status da sincronização. O `syncManager` roda fora do React e publica aqui
 * por `getState()/setState()`; qualquer tela lê por seletor. Os dados de
 * domínio e a fila continuam no WatermelonDB — aqui só o status.
 *
 * Persiste só `ultimaSincronizacaoEm`. `skipHydration`: quem hidrata é o
 * `AuthContext`, depois de decidir se o aparelho é do usuário que autenticou
 * (`estadosDoUsuario`) — ler do disco antes disso poderia trazer estado de outro.
 */
export function criarSincronizacaoStore(armazenamento: StateStorage) {
  return create<EstadoDaSincronizacao & AcoesDaSincronizacao>()(
    persist(
      (set) => ({
        ...ESTADO_INICIAL_DA_SINCRONIZACAO,
        dispensarAvisos: () => set({ avisosDescartados: [] }),
        reiniciar: () => set(ESTADO_INICIAL_DA_SINCRONIZACAO),
      }),
      {
        name: CHAVE_SINCRONIZACAO,
        version: 1,
        storage: createJSONStorage(() => armazenamento),
        skipHydration: true,
        partialize: (estado): EstadoPersistido => ({
          ultimaSincronizacaoEm: estado.ultimaSincronizacaoEm,
        }),
        merge: (persistido, atual) => {
          const { ultimaSincronizacaoEm } = (persistido ?? {}) as Partial<EstadoPersistido>;
          return {
            ...atual,
            ultimaSincronizacaoEm:
              typeof ultimaSincronizacaoEm === 'number' && Number.isFinite(ultimaSincronizacaoEm)
                ? ultimaSincronizacaoEm
                : atual.ultimaSincronizacaoEm,
          };
        },
      },
    ),
  );
}

export const useSincronizacaoStore = criarSincronizacaoStore(armazenamentoDoBanco(database));
