import { ActivityIndicator, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsBotao, TamanhoBotao, VarianteBotao } from '@montacontrol/ui-contracts/botao';
import { cores, raio, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { Texto } from './Texto';
import { Icone } from './Icone';

const alturaPorTamanho: Record<TamanhoBotao, number> = {
  40: espacamento[40],
  48: espacamento[48],
  56: espacamentoNomeado.alturaCampo,
};

const raioForma = { pilula: raio.full, retangular: raio.lg } as const;

/**
 * Cor do conteúdo (texto/ícone/spinner) por variante. Espelha
 * `apps/web/src/ui/Botao.tsx` (`classesPorVariante`): `fantasma` e `icone`
 * têm fundo transparente, então usam cor de texto/ícone, não `onPrimary`
 * (branco), senão ficariam invisíveis sobre a tela.
 */
const corConteudoPorVariante: Record<VarianteBotao, string> = {
  primario: cores.onPrimary,
  tonal: cores.onPrimaryContainer,
  fantasma: cores.primary,
  perigo: cores.onError,
  icone: cores.onSurfaceVariant,
};

/** Ver `login_montacontrol:139` — contrato completo em `@montacontrol/ui-contracts/botao`. */
export function Botao({
  variante,
  tamanho,
  forma,
  texto,
  icone,
  rotuloAcessivel,
  carregando = false,
  larguraTotal = false,
  desabilitado = false,
  aoPressionar,
}: PropsBotao) {
  const ehIcone = variante === 'icone';
  const altura = alturaPorTamanho[tamanho];
  const corConteudo = corConteudoPorVariante[variante];

  const conteudoBotao = carregando ? (
    <ActivityIndicator color={corConteudo} />
  ) : (
    <>
      {icone && <Icone nome={icone} cor={corConteudo} />}
      {!ehIcone && texto && (
        <Texto variante="titleMd" peso={700} cor={corConteudo}>
          {texto}
        </Texto>
      )}
    </>
  );

  const corpo = (
    <View
      style={{
        height: altura,
        width: ehIcone ? altura : undefined,
        borderRadius: raioForma[forma],
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: espacamento[8],
        paddingHorizontal: ehIcone ? 0 : espacamento[24],
        opacity: desabilitado ? 0.4 : 1,
        backgroundColor:
          variante === 'tonal' ? cores.primaryContainer : variante === 'perigo' ? cores.error : 'transparent',
      }}
    >
      {conteudoBotao}
    </View>
  );

  return (
    <Pressable
      testID="botao-pressable"
      accessibilityLabel={rotuloAcessivel}
      disabled={desabilitado || carregando}
      onPress={aoPressionar}
      style={({ pressed }) => [{ width: larguraTotal ? '100%' : undefined, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {variante === 'primario' ? (
        <LinearGradient
          colors={[cores.primary, cores.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: altura,
            borderRadius: raioForma[forma],
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: espacamento[8],
            paddingHorizontal: espacamento[24],
            opacity: desabilitado ? 0.4 : 1,
          }}
        >
          {conteudoBotao}
        </LinearGradient>
      ) : (
        corpo
      )}
    </Pressable>
  );
}
