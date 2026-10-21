import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';

interface PropsCabecalhoSubtela {
  titulo: string;
  aoVoltar: () => void;
}

/**
 * Cabeçalho das subtelas da aba Jornada (histórico, banco de horas): o
 * voltar fica no canto de cima, onde iOS e Android o colocam — no fim da
 * lista, o montador precisava rolar tudo para sair.
 */
export function CabecalhoSubtela({ titulo, aoVoltar }: PropsCabecalhoSubtela) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[4] }}>
      <View style={{ marginLeft: -espacamento[8] }}>
        <Botao
          variante="icone"
          tamanho={40}
          forma="pilula"
          icone="chevron_left"
          rotuloAcessivel="Voltar"
          aoPressionar={aoVoltar}
        />
      </View>
      <View style={{ flex: 1, gap: espacamento[2] }}>
        <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
          JORNADA
        </Texto>
        <Texto variante="headlineSm">{titulo}</Texto>
      </View>
    </View>
  );
}
