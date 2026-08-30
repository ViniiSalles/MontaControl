import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { estadoJornada, minutosDaJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO, JornadaDTO } from '@montacontrol/shared';
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

/**
 * Um turno por linha, em ordem cronológica.
 *
 * O card mostrava só o menor início e o maior fim do dia, e com isso dois
 * turnos (10:00–15:00 e 16:00–18:00) apareciam como um único 10:00–18:00 —
 * o intervalo do meio sumia e o dia parecia uma hora mais longo do que foi.
 * Cada turno é um par entrada/saída próprio; o total do dia é a soma deles,
 * não a distância entre as pontas.
 */
function LinhaTurno({
  jornada,
  ordem,
  agoraIso,
}: {
  jornada: JornadaDTO;
  ordem: number;
  agoraIso: string;
}) {
  const estado = estadoJornada(jornada, agoraIso);

  return (
    <View style={{ gap: espacamento[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
        <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
          {`${ordem}º TURNO`}
        </Texto>
        {estado === 'em_andamento' && <Badge variante="info" texto="Em andamento" />}
        {estado === 'vencida' && <Badge variante="erro" texto="Sem saída" />}
        {jornada.lancadoEmAtraso && <Badge variante="aviso" texto="Em atraso" />}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
        <Texto variante="bodyLg" tabular>
          {formatarHora(jornada.checkinAt)}
        </Texto>
        <Texto variante="bodyLg" cor={cores.onSurfaceVariant}>
          →
        </Texto>
        <Texto variante="bodyLg" tabular>
          {formatarHora(jornada.checkoutAt)}
        </Texto>
        <View style={{ flex: 1 }} />
        <Texto variante="bodyLg" cor={cores.onSurfaceVariant} tabular>
          {formatarDuracao(minutosDaJornada(jornada))}
        </Texto>
      </View>
    </View>
  );
}

export function CartaoDia({ dia, aoLancarEmAtraso }: PropsCartaoDia) {
  const agoraIso = new Date().toISOString();

  // O histórico vem do mais recente para o mais antigo; dentro do dia a
  // ordem que o montador espera é a do relógio.
  const turnos = [...dia.jornadas].sort((a, b) =>
    (a.checkinAt ?? '').localeCompare(b.checkinAt ?? ''),
  );

  const semSaida = turnos.some((turno) => turno.checkoutAt === null);
  // Com um turno só, o total do dia repetiria a duração da linha acima.
  const mostrarTotal = turnos.length > 1;

  return (
    <Cartao
      elevacao="elev1"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[12] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
            <Texto variante="titleMd">{formatarDiaCurto(dia.data)}</Texto>
            <View style={{ flex: 1 }} />
            <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
              {turnos.length === 1 ? '1 turno' : `${turnos.length} turnos`}
            </Texto>
          </View>

          {turnos.map((turno, indice) => (
            <LinhaTurno key={turno.id} jornada={turno} ordem={indice + 1} agoraIso={agoraIso} />
          ))}

          {mostrarTotal && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
              <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                TOTAL DO DIA
              </Texto>
              <View style={{ flex: 1 }} />
              <Texto variante="titleMd" tabular>
                {formatarDuracao(dia.minutosTrabalhados)}
              </Texto>
            </View>
          )}

          {semSaida && (
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
