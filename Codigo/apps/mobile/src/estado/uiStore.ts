import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { database } from '../db/database';
import type { CamposReporteAvaria } from '../avarias/validarReporteAvaria';
import { armazenamentoDoBanco } from './armazenamentoDoBanco';
import { CHAVE_UI } from './chavesPersistidas';

/**
 * Formulário de avaria em andamento. `fotos` são os NOMES dos arquivos em
 * `fotos/armazenamentoFotos` (nunca bytes nem base64): o rascunho é o dono
 * deles até o envio (a fila assume), o descarte explícito (apaga os arquivos)
 * ou o logout / troca de usuário (`apagarTodasAsFotos`).
 */
export interface RascunhoDeAvaria {
  campos: CamposReporteAvaria;
  fotos: string[];
}

export interface EstadoDaUi {
  /** Obra escolhida para o ponto de entrada. */
  obraEscolhidaId: number | null;
  rascunhoAvaria: RascunhoDeAvaria;
}

export interface AcoesDaUi {
  escolherObra: (id: number | null) => void;
  alterarRascunhoAvaria: (parcial: { campos?: Partial<CamposReporteAvaria> }) => void;
  anexarFotoAoRascunho: (nome: string) => void;
  removerFotoDoRascunho: (nome: string) => void;
  /** Zera a lista de fotos SEM apagar arquivos: a fila passou a ser dona deles. */
  soltarFotosDoRascunho: () => void;
  limparRascunhoAvaria: () => void;
  reiniciar: () => void;
}

const RASCUNHO_VAZIO: RascunhoDeAvaria = {
  campos: { pecaId: null, tipoAvariaId: null, descricao: '' },
  fotos: [],
};

export const ESTADO_INICIAL_DA_UI: EstadoDaUi = {
  obraEscolhidaId: null,
  rascunhoAvaria: RASCUNHO_VAZIO,
};

const numeroOuNulo = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null;

/** Lê o que veio do disco campo a campo: o que não tem o tipo certo volta ao valor vazio. */
function sanitizar(persistido: unknown): EstadoDaUi {
  const bruto = (persistido ?? {}) as Partial<Record<keyof EstadoDaUi, unknown>>;
  const rascunho = (bruto.rascunhoAvaria ?? {}) as Record<string, unknown>;
  const campos = (rascunho.campos ?? {}) as Record<string, unknown>;

  // Rascunho de versão antiga pode trazer `pedidoId` (o pedido agora vem do ponto): é ignorado.
  return {
    obraEscolhidaId: numeroOuNulo(bruto.obraEscolhidaId),
    rascunhoAvaria: {
      campos: {
        pecaId: numeroOuNulo(campos.pecaId),
        tipoAvariaId: numeroOuNulo(campos.tipoAvariaId),
        descricao: typeof campos.descricao === 'string' ? campos.descricao : '',
      },
      fotos: Array.isArray(rascunho.fotos)
        ? rascunho.fotos.filter((foto): foto is string => typeof foto === 'string')
        : [],
    },
  };
}

/**
 * Estado de interface que precisa sobreviver a fechar o app: obra do ponto e
 * rascunho de avaria. Não guarda dado do usuário (nome, e-mail): o `localStorage`
 * do banco não é criptografado. `skipHydration` pelo mesmo motivo do store de
 * sincronização: o `AuthContext` hidrata depois de decidir o dono do aparelho.
 */
export function criarUiStore(armazenamento: StateStorage) {
  return create<EstadoDaUi & AcoesDaUi>()(
    persist(
      (set) => ({
        ...ESTADO_INICIAL_DA_UI,
        escolherObra: (id) => set({ obraEscolhidaId: id }),
        alterarRascunhoAvaria: ({ campos }) =>
          set((estado) => ({
            rascunhoAvaria: {
              ...estado.rascunhoAvaria,
              campos: { ...estado.rascunhoAvaria.campos, ...campos },
            },
          })),
        anexarFotoAoRascunho: (nome) =>
          set((estado) =>
            estado.rascunhoAvaria.fotos.includes(nome)
              ? estado
              : {
                  rascunhoAvaria: {
                    ...estado.rascunhoAvaria,
                    fotos: [...estado.rascunhoAvaria.fotos, nome],
                  },
                },
          ),
        removerFotoDoRascunho: (nome) =>
          set((estado) => ({
            rascunhoAvaria: {
              ...estado.rascunhoAvaria,
              fotos: estado.rascunhoAvaria.fotos.filter((foto) => foto !== nome),
            },
          })),
        soltarFotosDoRascunho: () =>
          set((estado) => ({ rascunhoAvaria: { ...estado.rascunhoAvaria, fotos: [] } })),
        limparRascunhoAvaria: () => set({ rascunhoAvaria: RASCUNHO_VAZIO }),
        reiniciar: () => set(ESTADO_INICIAL_DA_UI),
      }),
      {
        name: CHAVE_UI,
        version: 1,
        storage: createJSONStorage(() => armazenamento),
        skipHydration: true,
        partialize: (estado): EstadoDaUi => ({
          obraEscolhidaId: estado.obraEscolhidaId,
          rascunhoAvaria: estado.rascunhoAvaria,
        }),
        merge: (persistido, atual) =>
          persistido === undefined ? atual : { ...atual, ...sanitizar(persistido) },
      },
    ),
  );
}

export const useUiStore = criarUiStore(armazenamentoDoBanco(database));
