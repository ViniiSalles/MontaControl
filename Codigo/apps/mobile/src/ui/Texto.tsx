import { Text } from 'react-native';
import type { PropsTexto } from '@montacontrol/ui-contracts/texto';
import { estiloTexto, tipografia, cores } from '@montacontrol/design-tokens/native';

const alinhamentoParaTextAlign = { esquerda: 'left', centro: 'center', direita: 'right' } as const;

export function Texto({
  variante,
  cor = cores.onSurface,
  peso,
  alinhamento,
  numeroDeLinhas,
  tabular,
  children,
}: PropsTexto) {
  const estilo = estiloTexto(tipografia[variante], peso, tabular);
  return (
    <Text
      style={[estilo, { color: cor }, alinhamento && { textAlign: alinhamentoParaTextAlign[alinhamento] }]}
      numberOfLines={numeroDeLinhas}
    >
      {children}
    </Text>
  );
}
