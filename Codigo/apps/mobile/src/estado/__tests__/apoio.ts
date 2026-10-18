import type { StateStorage } from 'zustand/middleware';

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
