import { createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { reidratarEstadosPersistidos } from '../estadosDoUsuario';
import { useSincronizacaoStore } from '../sincronizacaoStore';
import { useUiStore } from '../uiStore';

/** Armazenamento de chave-valor em memória: o "disco" que sobrevive a "fechar e reabrir" o app nos testes. */
export function armazenamentoEmMemoria() {
  const dados = new Map<string, string>();
  const armazenamento: StateStorage = {
    getItem: async (nome) => dados.get(nome) ?? null,
    setItem: async (nome, valor) => {
      dados.set(nome, valor);
    },
    removeItem: async (nome) => {
      dados.delete(nome);
    },
  };
  return { dados, armazenamento };
}

/**
 * Troca o armazenamento dos stores do app (o localStorage do banco, indisponível
 * no Jest) por um "disco" em memória e devolve `fecharEReabrirOApp`: a memória
 * dos stores some e o que estava no disco é hidratado de novo, como num boot.
 */
export function instalarDiscoEmMemoria() {
  const disco = armazenamentoEmMemoria();
  const storage = createJSONStorage(() => disco.armazenamento);
  useUiStore.persist.setOptions({ storage });
  useSincronizacaoStore.persist.setOptions({ storage });
  useUiStore.getState().reiniciar();
  useSincronizacaoStore.getState().reiniciar();
  disco.dados.clear();

  async function fecharEReabrirOApp() {
    const noDisco = new Map(disco.dados);
    useUiStore.getState().reiniciar();
    useSincronizacaoStore.getState().reiniciar();
    disco.dados.clear();
    noDisco.forEach((valor, chave) => disco.dados.set(chave, valor));
    await reidratarEstadosPersistidos();
  }

  return { ...disco, fecharEReabrirOApp };
}
