import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import type { DiaJornadaDTO } from '@montacontrol/shared';
import { Badge } from '../../ui/Badge';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { formatarDiaCurto, formatarDuracao, formatarHora } from '../../jornada/formatacao';

interface PropsCartaoDia {
  dia: DiaJornadaDTO;
  /** Abre o formulário de ponto em atraso já com a data deste card. */
  aoLancarEmAtraso: (data: string) => void;
}

export function CartaoDia({ dia, aoLancarEmAtraso }: PropsCartaoDia) {
  const temAtraso = dia.jornadas.some((jornada) => jornada.lancadoEmAtraso);
  // Dia terminado sem check-out não é "em andamento": é ponto faltando, e o
  // montador precisa do atalho para corrigir.
  const semCheckout = dia.emAndamento && dia.fim === null;

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[8] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
            <Texto variante="titleMd">{formatarDiaCurto(dia.data)}</Texto>
            {dia.emAndamento && <Badge variante="info" texto="Em andamento" />}
            {temAtraso && <Badge variante="aviso" texto="Em atraso" />}
          </View>

          <View style={{ flexDirection: 'row', gap: espacamento[16] }}>
            <View>
              <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                ENTRADA
              </Texto>
              <Texto variante="bodyLg">{formatarHora(dia.inicio)}</Texto>
            </View>
            <View>
              <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                SAÍDA
              </Texto>
              <Texto variante="bodyLg">{formatarHora(dia.fim)}</Texto>
            </View>
            <View>
              <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                TOTAL
              </Texto>
              <Texto variante="bodyLg">{formatarDuracao(dia.minutosTrabalhados)}</Texto>
            </View>
          </View>

          {semCheckout && (
            <Botao
              variante="fantasma"
              tamanho={40}
              forma="pilula"
              texto="Lançar ponto em atraso"
              aoPressionar={() => aoLancarEmAtraso(dia.data)}
            />
          )}
        </View>
      }
    />
  );
}
