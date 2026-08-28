import { Platform, View } from 'react-native';
import type { PropsCartao } from '@montacontrol/ui-contracts/cartao';
import { cores, raio, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { sombraPorNivel } from '@montacontrol/design-tokens/native/sombra';

/** Ver `PropsCartao` (`packages/ui-contracts/src/cartao.ts`) para o mapeamento tom -> papel semântico. */
const corPorTom = {
  padrao: cores.surfaceContainerLowest,
  baixo: cores.surfaceContainerLow,
  inverso: cores.inverseSurface,
} as const;

/**
 * Ver `jornada_home:111`; sem borda nem linha divisória (DESIGN.md §5,
 * "Cards: Forbid divider lines") — separação corpo/rodapé é só por mudança
 * de tom (`surfaceContainerLowest` no corpo, `surfaceContainerLow` no
 * rodapé).
 */
export function Cartao({ elevacao, tom, conteudo, rodape }: PropsCartao) {
  return (
    <View
      style={[
        { borderRadius: raio.lg, overflow: 'hidden', backgroundColor: corPorTom[tom] },
        elevacao !== 'none' && sombraPorNivel(elevacao, Platform.OS === 'android' ? 'android' : 'ios'),
      ]}
    >
      <View style={{ padding: espacamentoNomeado.paddingCartao }}>{conteudo}</View>
      {rodape && (
        <View style={{ padding: espacamentoNomeado.paddingCartao, backgroundColor: cores.surfaceContainerLow }}>
          {rodape}
        </View>
      )}
    </View>
  );
}
