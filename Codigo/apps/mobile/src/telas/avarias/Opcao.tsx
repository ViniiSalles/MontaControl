import { Pressable } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Texto } from '../../ui/Texto';

interface PropsOpcao {
  rotulo: string;
  detalhe?: string;
  selecionada: boolean;
  aoPressionar: () => void;
  /** `chip` para escolhas curtas lado a lado; `linha` para itens de lista. */
  forma?: 'chip' | 'linha';
}

/** Escolha única tocável (pedido, peça, tipo de problema) — estado só por tom, sem borda divisória. */
export function Opcao({ rotulo, detalhe, selecionada, aoPressionar, forma = 'chip' }: PropsOpcao) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={detalhe ? `${rotulo}, ${detalhe}` : rotulo}
      onPress={aoPressionar}
      style={{
        paddingVertical: espacamento[10],
        paddingHorizontal: espacamento[16],
        borderRadius: forma === 'chip' ? raio.full : raio.md,
        backgroundColor: selecionada ? cores.primaryFixed : cores.surfaceContainerLow,
        borderWidth: 2,
        borderColor: selecionada ? cores.primary : cores.surfaceContainerLow,
        alignSelf: forma === 'chip' ? 'flex-start' : 'stretch',
      }}
    >
      <Texto variante="titleSm" cor={selecionada ? cores.onPrimaryFixed : cores.onSurface}>
        {rotulo}
      </Texto>
      {detalhe && (
        <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
          {detalhe}
        </Texto>
      )}
    </Pressable>
  );
}
