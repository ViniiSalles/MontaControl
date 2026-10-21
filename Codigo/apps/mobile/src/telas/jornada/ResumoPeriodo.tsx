import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { formatarDuracao } from '../../jornada/formatacao';

interface PropsResumoPeriodo {
  totalMinutos: number;
  diasTrabalhados: number;
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flex: 1, gap: espacamento[4] }}>
      <Texto variante="labelSm" cor={cores.onSecondary}>
        {rotulo}
      </Texto>
      <Texto variante="titleLg" cor={cores.onSecondary} tabular>
        {valor}
      </Texto>
    </View>
  );
}

/**
 * Resumo do período no cartão de destaque do Stitch (`HistoricoDePonto`): total,
 * dias trabalhados e média por dia. Extras e faltas do mockup ficam de fora —
 * o app não tem a jornada prevista por dia, só o total previsto do mês.
 */
export function ResumoPeriodo({ totalMinutos, diasTrabalhados }: PropsResumoPeriodo) {
  const media = diasTrabalhados > 0 ? formatarDuracao(Math.round(totalMinutos / diasTrabalhados)) : '—';

  return (
    <Cartao
      elevacao="elev1"
      tom="destaque"
      conteudo={
        <View style={{ gap: espacamento[16] }}>
          <View style={{ gap: espacamento[4] }}>
            <Texto variante="labelSm" cor={cores.onSecondary}>
              TOTAL NO PERÍODO
            </Texto>
            <Texto variante="headlineMd" cor={cores.onSecondary} tabular>
              {formatarDuracao(totalMinutos)}
            </Texto>
          </View>
          <View style={{ flexDirection: 'row', gap: espacamento[16] }}>
            <Metrica rotulo="DIAS TRABALHADOS" valor={String(diasTrabalhados)} />
            <Metrica rotulo="MÉDIA POR DIA" valor={media} />
          </View>
        </View>
      }
    />
  );
}
