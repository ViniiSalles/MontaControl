import { ActivityIndicator, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';

interface PropsBotaoAcaoPrincipal {
  texto: string;
  carregando?: boolean;
  desabilitado?: boolean;
  aoPressionar: () => void;
}

/**
 * Tile de ação principal da Jornada (`jornada_home:161-171`): mesmo
 * gradiente do `Botao variante="primario"`, em formato de cartão em vez de
 * pílula — é onde o dedo do montador bate o ponto.
 */
export function BotaoAcaoPrincipal({
  texto,
  carregando = false,
  desabilitado = false,
  aoPressionar,
}: PropsBotaoAcaoPrincipal) {
  return (
    <Pressable
      testID="botao-acao-principal"
      disabled={desabilitado || carregando}
      onPress={aoPressionar}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <LinearGradient
        colors={[cores.primary, cores.primaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: raio.xxl,
          paddingVertical: espacamento[32],
          alignItems: 'center',
          justifyContent: 'center',
          gap: espacamento[12],
          opacity: desabilitado ? 0.4 : 1,
        }}
      >
        <View
          style={{
            width: espacamento[64],
            height: espacamento[64],
            borderRadius: raio.full,
            // Círculo translúcido sobre o gradiente — mesmo truque de alpha
            // hex de `Modal.tsx` (`cores.scrim` + sufixo), aqui com `onPrimary`.
            backgroundColor: `${cores.onPrimary}33`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {carregando ? (
            <ActivityIndicator color={cores.onPrimary} />
          ) : (
            <Icone nome="fingerprint" tamanho={espacamento[32]} cor={cores.onPrimary} />
          )}
        </View>
        <Texto variante="titleLg" peso={700} cor={cores.onPrimary}>
          {texto}
        </Texto>
      </LinearGradient>
    </Pressable>
  );
}
