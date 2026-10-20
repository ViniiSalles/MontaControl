import { Pressable, View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import type { PeriodoHistorico } from '@montacontrol/shared';
import { Texto } from '../../ui/Texto';

const PERIODOS: PeriodoHistorico[] = [5, 15, 30];

interface PropsSeletorPeriodo {
  periodo: PeriodoHistorico;
  aoTrocar: (periodo: PeriodoHistorico) => void;
}

/**
 * Controle segmentado: uma pílula só, com o período ativo destacado. Os três
 * botões soltos de antes (o ativo cheio, os outros só texto) liam como um
 * botão e dois links.
 */
export function SeletorPeriodo({ periodo, aoTrocar }: PropsSeletorPeriodo) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        padding: espacamento[4],
        gap: espacamento[4],
        borderRadius: raio.full,
        backgroundColor: cores.surfaceContainerHigh,
      }}
    >
      {PERIODOS.map((opcao) => {
        const ativo = opcao === periodo;
        return (
          <Pressable
            key={opcao}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            onPress={() => aoTrocar(opcao)}
            style={{
              flex: 1,
              minHeight: espacamento[40],
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: raio.full,
              backgroundColor: ativo ? cores.surfaceContainerLowest : 'transparent',
            }}
          >
            <Texto
              variante="labelLg"
              peso={ativo ? 700 : undefined}
              cor={ativo ? cores.primary : cores.onSurfaceVariant}
            >
              {`${opcao} dias`}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}
