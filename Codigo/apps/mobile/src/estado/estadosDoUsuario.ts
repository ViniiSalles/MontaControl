import { useSincronizacaoStore } from './sincronizacaoStore';
import { useUiStore } from './uiStore';

/**
 * Ciclo de vida dos stores persistidos em relação à sessão. Quem decide o que
 * sobrevive é o `AuthContext`; estas funções só executam, sempre em melhor
 * esforço (nunca rejeitam — o apagamento garantido do disco é o wipe do banco).
 *
 * | Evento                                   | UI (obra, rascunho) | Sincronização |
 * | ---------------------------------------- | ------------------- | ------------- |
 * | Logout explícito                         | apaga               | apaga         |
 * | Login de OUTRO usuário (wipe do banco)   | apaga               | apaga         |
 * | Perfil recusado                          | apaga               | apaga         |
 * | Expiração forçada (fila fica)            | MANTÉM (mesmo dono) | apaga         |
 * | Boot / login do MESMO usuário            | reidrata            | reidrata      |
 *
 * Memória E disco: zerar só o disco deixaria o estado vivo na tela; zerar só a
 * memória faria o próximo boot ler tudo de volta.
 */

type StoreComPersist = Pick<typeof useUiStore | typeof useSincronizacaoStore, 'persist'>;

async function apagarDoDisco(store: StoreComPersist): Promise<void> {
  try {
    // Também invalida uma hidratação em andamento (não deixa o estado velho voltar).
    store.persist.clearStorage();
    const { storage, name } = store.persist.getOptions();
    if (storage && name) await storage.removeItem(name);
  } catch {
    // Ver cabeçalho: o wipe do banco é quem garante.
  }
}

/** Logout explícito, troca de usuário, perfil recusado: nada do usuário anterior fica. */
export function descartarEstadosDoUsuario(): Promise<void> {
  // Memória primeiro e de forma síncrona: nenhuma tela lê o estado antigo.
  useUiStore.getState().reiniciar();
  useSincronizacaoStore.getState().reiniciar();
  return Promise.all([apagarDoDisco(useUiStore), apagarDoDisco(useSincronizacaoStore)]).then(
    () => undefined,
  );
}

/**
 * Expiração forçada da sessão: a réplica do servidor some, então o status da
 * sincronização (que a descreve) também. Obra e rascunho são do mesmo montador
 * dono da fila mantida e ficam — o próximo login do mesmo usuário os encontra;
 * o de outro cai no wipe e `descartarEstadosDoUsuario`.
 */
export function descartarEstadosDaReplica(): Promise<void> {
  useSincronizacaoStore.getState().reiniciar();
  return apagarDoDisco(useSincronizacaoStore);
}

/**
 * Lê do disco os estados do usuário que acabou de autenticar. Só depois de
 * `reconciliarFilaCom` (que apaga o disco se o aparelho era de outro): hidratar
 * antes poderia trazer o rascunho do usuário anterior.
 */
export async function reidratarEstadosPersistidos(): Promise<void> {
  try {
    await Promise.all([useUiStore.persist.rehydrate(), useSincronizacaoStore.persist.rehydrate()]);
  } catch {
    // Sem o disco o app abre com os valores padrão.
  }
}
