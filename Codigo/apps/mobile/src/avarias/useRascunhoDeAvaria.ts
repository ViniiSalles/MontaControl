import { useCallback } from 'react';
import { geracaoDaSessao } from '../auth/tokenSessao';
import { useUiStore } from '../estado/uiStore';
import { apagarFotos, salvarFoto } from '../fotos/armazenamentoFotos';
import type { MimeTypeFoto } from '../fotos/armazenamentoFotos';
import type { CamposReporteAvaria } from './validarReporteAvaria';

export interface RascunhoDeAvariaEmEdicao {
  campos: CamposReporteAvaria;
  /** Nomes dos arquivos das fotos já guardadas no aparelho, na ordem de anexo; `uriDaFoto` dá a miniatura. */
  caminhos: string[];
  /** Há algo que valha descartar (texto, peça, tipo ou foto). */
  temConteudo: boolean;
  alterar: <C extends keyof CamposReporteAvaria>(campo: C, valor: CamposReporteAvaria[C]) => void;
  /** Copia a foto do picker para a pasta do app e a põe no rascunho. Rejeita se não conseguir copiar. */
  adicionarFoto: (uri: string, mimeType: MimeTypeFoto) => Promise<void>;
  /** Tira a foto do rascunho e apaga o arquivo. */
  remover: (indice: number) => Promise<void>;
  /** Zera a lista de fotos SEM apagar os arquivos: a fila passa a ser a dona deles (chamar ao entregá-los ao outbox, antes da rede). */
  esquecerFotos: () => void;
  /** Zera os campos (envio aceito). */
  limparCampos: () => void;
  /** Descarte explícito: apaga os arquivos das fotos e esvazia o rascunho inteiro. */
  descartar: () => Promise<void>;
}

const CAMPOS_VAZIOS: CamposReporteAvaria = { pecaId: null, tipoAvariaId: null, descricao: '' };

/**
 * Formulário de avaria sobre o `uiStore` persistido: fechar a tela, trocar de
 * aba ou fechar o app não perde o que o montador já preencheu nem as fotos.
 *
 * O rascunho é o dono dos arquivos das fotos até: o envio (o outbox assume —
 * `esquecerFotos` solta sem apagar), o descarte explícito (`descartar`,
 * `remover`) ou o logout / troca de usuário (`apagarTodasAsFotos`). Por isso
 * desmontar a tela NÃO apaga nada.
 */
export function useRascunhoDeAvaria(): RascunhoDeAvariaEmEdicao {
  const rascunho = useUiStore((estado) => estado.rascunhoAvaria);
  const alterarRascunhoAvaria = useUiStore((estado) => estado.alterarRascunhoAvaria);
  const anexarFotoAoRascunho = useUiStore((estado) => estado.anexarFotoAoRascunho);
  const removerFotoDoRascunho = useUiStore((estado) => estado.removerFotoDoRascunho);

  const alterar = useCallback(
    <C extends keyof CamposReporteAvaria>(campo: C, valor: CamposReporteAvaria[C]) =>
      alterarRascunhoAvaria({ campos: { [campo]: valor } }),
    [alterarRascunhoAvaria],
  );

  const adicionarFoto = useCallback(
    async (uri: string, mimeType: MimeTypeFoto) => {
      const geracao = geracaoDaSessao();
      const nome = await salvarFoto(uri, mimeType);
      if (geracaoDaSessao() !== geracao) {
        // A sessão acabou enquanto a foto era copiada: o rascunho já é de outro
        // (ou de ninguém) e o arquivo não pode ficar no aparelho.
        await apagarFotos([nome]).catch(() => undefined);
        return;
      }
      anexarFotoAoRascunho(nome);
    },
    [anexarFotoAoRascunho],
  );

  const remover = useCallback(
    async (indice: number) => {
      const removida = useUiStore.getState().rascunhoAvaria.fotos[indice];
      if (removida === undefined) return;
      removerFotoDoRascunho(removida);
      await apagarFotos([removida]).catch(() => undefined);
    },
    [removerFotoDoRascunho],
  );

  const esquecerFotos = useCallback(() => useUiStore.getState().soltarFotosDoRascunho(), []);

  const limparCampos = useCallback(
    () => alterarRascunhoAvaria({ campos: CAMPOS_VAZIOS }),
    [alterarRascunhoAvaria],
  );

  const descartar = useCallback(async () => {
    const fotos = useUiStore.getState().rascunhoAvaria.fotos;
    useUiStore.getState().limparRascunhoAvaria();
    await apagarFotos(fotos).catch(() => undefined);
  }, []);

  const temConteudo =
    rascunho.campos.pecaId !== null ||
    rascunho.campos.tipoAvariaId !== null ||
    rascunho.campos.descricao.trim() !== '' ||
    rascunho.fotos.length > 0;

  return {
    campos: rascunho.campos,
    caminhos: rascunho.fotos,
    temConteudo,
    alterar,
    adicionarFoto,
    remover,
    esquecerFotos,
    limparCampos,
    descartar,
  };
}
