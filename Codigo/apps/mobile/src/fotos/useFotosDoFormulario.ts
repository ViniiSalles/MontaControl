import { useCallback, useEffect, useRef, useState } from 'react';
import { apagarFotos, salvarFoto } from './armazenamentoFotos';
import type { MimeTypeFoto } from './armazenamentoFotos';

export interface FotosDoFormulario {
  /** Referências (nome do arquivo) das fotos já guardadas no aparelho, na ordem em que foram anexadas; `uriDaFoto` dá a URI da miniatura. */
  caminhos: string[];
  /** Copia a foto do picker para a pasta do app e a põe na lista. Rejeita se não conseguir copiar. */
  adicionar: (uri: string, mimeType: MimeTypeFoto) => Promise<void>;
  /** Tira a foto da lista e apaga o arquivo. */
  remover: (indice: number) => Promise<void>;
  /** Zera a lista sem apagar os arquivos: a fila passa a ser a dona deles (chamar ao entregá-los ao outbox, antes da rede). */
  esquecer: () => void;
}

/**
 * Fotos de um formulário (avaria, atestado). Cada foto vira arquivo assim que
 * é anexada, e o formulário só carrega o caminho. O que não chegou à fila
 * (formulário fechado sem enviar, foto removida) é apagado — documento de
 * saúde não pode ficar órfão no aparelho. Depois de enfileirar, o formulário
 * chama `esquecer` e os arquivos passam a ser da fila.
 *
 * A lista é espelhada num ref porque o cleanup do desmonte precisa do valor
 * mais recente.
 */
export function useFotosDoFormulario(): FotosDoFormulario {
  const [caminhos, setCaminhos] = useState<string[]>([]);
  const caminhosRef = useRef<string[]>([]);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      void apagarFotos(caminhosRef.current).catch(() => undefined);
    };
  }, []);

  const adicionar = useCallback(async (uri: string, mimeType: MimeTypeFoto) => {
    const caminho = await salvarFoto(uri, mimeType);
    if (!montadoRef.current) {
      // O formulário já fechou enquanto a foto era copiada: ninguém vai usá-la.
      await apagarFotos([caminho]).catch(() => undefined);
      return;
    }
    caminhosRef.current = [...caminhosRef.current, caminho];
    setCaminhos(caminhosRef.current);
  }, []);

  const remover = useCallback(async (indice: number) => {
    const removida = caminhosRef.current[indice];
    if (removida === undefined) return;
    caminhosRef.current = caminhosRef.current.filter((_, i) => i !== indice);
    setCaminhos(caminhosRef.current);
    await apagarFotos([removida]).catch(() => undefined);
  }, []);

  const esquecer = useCallback(() => {
    caminhosRef.current = [];
    setCaminhos([]);
  }, []);

  return { caminhos, adicionar, remover, esquecer };
}
