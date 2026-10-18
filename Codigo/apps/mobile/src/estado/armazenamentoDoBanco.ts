import type { Database } from '@nozbe/watermelondb';
import type { StateStorage } from 'zustand/middleware';

/**
 * Armazenamento do `persist` do Zustand sobre o `localStorage` do WatermelonDB
 * (chave-valor assíncrono dentro do próprio banco local). Escolha por
 * consequência: o wipe do logout (`unsafeResetDatabase`) e o da troca de
 * usuário apagam estas chaves junto com a fila, sem lista paralela para
 * esquecer; e nenhuma dependência nativa nova (o MMKV exigiria rebuild).
 *
 * Só para estado NÃO sensível (obra escolhida, rascunho de avaria, instante da
 * última sincronização) — nome e e-mail do usuário nunca passam por aqui, e os
 * tokens ficam no SecureStore. O valor é o texto JSON que o `persist` produz.
 *
 * Melhor esforço, como `armazenamentoSessao`: falha do banco nunca rejeita
 * nem derruba o app. Ler com erro vira "nada guardado" (valores padrão); gravar
 * com erro só perde a persistência. O apagamento garantido é o do wipe do
 * banco, não o de `removeItem`.
 */
export function armazenamentoDoBanco(database: Database): StateStorage {
  return {
    async getItem(nome) {
      try {
        const valor = await database.localStorage.get<unknown>(nome);
        return typeof valor === 'string' ? valor : null;
      } catch {
        return null;
      }
    },
    async setItem(nome, valor) {
      try {
        await database.localStorage.set(nome, valor);
      } catch {
        // O estado segue em memória; só não sobrevive ao fechamento do app.
      }
    },
    async removeItem(nome) {
      try {
        await database.localStorage.remove(nome);
      } catch {
        // O wipe do banco (logout / troca de usuário) é quem garante o apagamento.
      }
    },
  };
}
