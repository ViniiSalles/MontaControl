import { View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';

interface PropsCartaoProgresso {
  conferidas: number;
  total: number;
}

/** "Status da bipagem": quantas peças do pedido ativo já foram bipadas. */
export function CartaoProgresso({ conferidas, total }: PropsCartaoProgresso) {
  const percentual = total === 0 ? 0 : Math.round((conferidas / total) * 100);

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[12] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            STATUS DA BIPAGEM
          </Texto>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: espacamento[8] }}>
            <Texto variante="headlineLg" tabular>
              {conferidas}
            </Texto>
            <View style={{ flex: 1 }}>
              <Texto variante="bodyLg" cor={cores.onSurfaceVariant}>
                / {total} {total === 1 ? 'peça' : 'peças'}
              </Texto>
            </View>
            <Texto variante="titleLg" cor={cores.primary} tabular>
              {percentual}%
            </Texto>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: total, now: conferidas }}
            style={{
              height: espacamento[8],
              borderRadius: raio.full,
              backgroundColor: cores.primaryFixed,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${percentual}%`,
                height: '100%',
                borderRadius: raio.full,
                backgroundColor: cores.tertiaryContainer,
              }}
            />
          </View>
        </View>
      }
    />
  );
}
