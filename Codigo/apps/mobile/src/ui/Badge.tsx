import { View } from 'react-native';
import type { PropsBadge } from '@montacontrol/ui-contracts/badge';
import { cores, raio, espacamento } from '@montacontrol/design-tokens/native';
import { Texto } from './Texto';

const corPorVariante = {
  sucesso: { fundo: cores.successContainer, texto: cores.onSuccessContainer },
  aviso: { fundo: cores.tertiaryFixed, texto: cores.onTertiaryFixedVariant },
  erro: { fundo: cores.errorContainer, texto: cores.onErrorContainer },
  info: { fundo: cores.primaryFixed, texto: cores.onPrimaryFixedVariant },
  neutro: { fundo: cores.surfaceContainerHigh, texto: cores.onSurfaceVariant },
} as const;

export function Badge({ variante, texto }: PropsBadge) {
  const cor = corPorVariante[variante];
  return (
    <View
      testID="badge-container"
      style={{
        backgroundColor: cor.fundo,
        borderRadius: raio.full,
        paddingHorizontal: espacamento[10],
        paddingVertical: espacamento[4],
        alignSelf: 'flex-start',
      }}
    >
      <Texto variante="labelSm" cor={cor.texto}>
        {texto.toUpperCase()}
      </Texto>
    </View>
  );
}
