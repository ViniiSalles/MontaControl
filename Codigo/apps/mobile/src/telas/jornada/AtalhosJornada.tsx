import { Pressable, View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';

interface PropsAtalho {
  icone: NomeIcone;
  rotulo: string;
  aoPressionar: () => void;
}

function Atalho({ icone, rotulo, aoPressionar }: PropsAtalho) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoPressionar}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacamento[12],
        minHeight: espacamento[48],
        paddingHorizontal: espacamento[8],
        borderRadius: raio.md,
        backgroundColor: pressed ? cores.surfaceContainerLow : 'transparent',
      })}
    >
      <Icone nome={icone} tamanho={espacamento[24]} cor={cores.primary} />
      <View style={{ flex: 1 }}>
        <Texto variante="titleSm">{rotulo}</Texto>
      </View>
      <Icone nome="chevron_right" tamanho={espacamento[20]} cor={cores.onSurfaceVariant} />
    </Pressable>
  );
}

interface PropsAtalhosJornada {
  aoAbrirHistorico: () => void;
  aoLancarEmAtraso: () => void;
}

/**
 * Atalhos secundários da Jornada em lista, e não em botões `tonal`: o azul
 * cheio do tonal competia com o botão de bater ponto, que é a única ação
 * principal da tela.
 */
export function AtalhosJornada({ aoAbrirHistorico, aoLancarEmAtraso }: PropsAtalhosJornada) {
  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[4], marginVertical: -espacamento[8] }}>
          <Atalho icone="history" rotulo="Histórico de pontos" aoPressionar={aoAbrirHistorico} />
          <Atalho icone="pending_actions" rotulo="Lançar ponto em atraso" aoPressionar={aoLancarEmAtraso} />
        </View>
      }
    />
  );
}
