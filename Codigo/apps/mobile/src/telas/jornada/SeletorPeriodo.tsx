import { View } from 'react-native';
import { espacamento } from '@montacontrol/design-tokens/native';
import type { PeriodoHistorico } from '@montacontrol/shared';
import { Botao } from '../../ui/Botao';

const PERIODOS: PeriodoHistorico[] = [5, 15, 30];

interface PropsSeletorPeriodo {
  periodo: PeriodoHistorico;
  aoTrocar: (periodo: PeriodoHistorico) => void;
}

export function SeletorPeriodo({ periodo, aoTrocar }: PropsSeletorPeriodo) {
  return (
    <View style={{ flexDirection: 'row', gap: espacamento[8] }}>
      {PERIODOS.map((opcao) => (
        <Botao
          key={opcao}
          variante={opcao === periodo ? 'primario' : 'fantasma'}
          tamanho={40}
          forma="pilula"
          texto={`${opcao} dias`}
          aoPressionar={() => aoTrocar(opcao)}
        />
      ))}
    </View>
  );
}
