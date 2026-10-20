import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import type { TipoAvariaDTO } from '@montacontrol/shared';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Modal } from '../../ui/Modal';
import { Texto } from '../../ui/Texto';
import { ordenarTiposComOutroPorUltimo } from '../../avarias/tiposAvaria';
import { Opcao } from './Opcao';

interface PropsSeletorTipoProblema {
  tipos: TipoAvariaDTO[];
  selecionadoId: number | null;
  aoSelecionar: (id: number) => void;
  erro?: string;
}

/**
 * Tipo de problema da peça no mesmo padrão do seletor de obra: uma linha
 * compacta que abre a lista num modal (com a descrição de cada tipo), em vez
 * de chips soltos no meio do formulário. "Outro" fica sempre por último.
 */
export function SeletorTipoProblema({
  tipos,
  selecionadoId,
  aoSelecionar,
  erro,
}: PropsSeletorTipoProblema) {
  const [aberto, setAberto] = useState(false);
  const selecionado = tipos.find((tipo) => tipo.id === selecionadoId) ?? null;
  const titulo = selecionado ? selecionado.nome : 'Nenhum problema escolhido';
  const acao = selecionado ? 'Trocar' : 'Escolher';

  return (
    <View style={{ gap: espacamento[8] }}>
      <Cartao
        elevacao="none"
        tom="baixo"
        conteudo={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Problema: ${titulo}. ${acao}`}
            onPress={() => setAberto(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}
          >
            <Icone
              nome="report"
              tamanho={espacamento[24]}
              cor={selecionado ? cores.primary : cores.tertiary}
            />
            <View style={{ flex: 1, gap: espacamento[2] }}>
              <Texto variante="labelSm" cor={cores.onSurfaceVariant}>
                PROBLEMA
              </Texto>
              <Texto variante="titleSm" numeroDeLinhas={1}>
                {titulo}
              </Texto>
            </View>
            <Texto variante="labelLg" cor={cores.primary}>
              {acao}
            </Texto>
          </Pressable>
        }
      />
      {erro && (
        <Texto variante="labelMd" cor={cores.error}>
          {erro}
        </Texto>
      )}

      <Modal
        visivel={aberto}
        apresentacao="folha"
        titulo="Tipo de problema"
        aoFechar={() => setAberto(false)}
        conteudo={
          <View style={{ gap: espacamento[8], paddingBottom: espacamento[24] }}>
            {ordenarTiposComOutroPorUltimo(tipos).map((tipo) => (
              <Opcao
                key={tipo.id}
                forma="linha"
                rotulo={tipo.nome}
                detalhe={tipo.descricao}
                selecionada={tipo.id === selecionadoId}
                aoPressionar={() => {
                  aoSelecionar(tipo.id);
                  setAberto(false);
                }}
              />
            ))}
          </View>
        }
      />
    </View>
  );
}
