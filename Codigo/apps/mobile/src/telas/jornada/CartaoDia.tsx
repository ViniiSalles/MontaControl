import { Platform, View } from 'react-native';
import { cores, espacamento, espacamentoNomeado, raio } from '@montacontrol/design-tokens/native';
import { sombraPorNivel } from '@montacontrol/design-tokens/native/sombra';
import { estadoJornada, minutosDaJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO, EstadoJornada, JornadaDTO } from '@montacontrol/shared';
import { Badge } from '../../ui/Badge';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';
import {
  formatarDiaDaSemana,
  formatarDiaEMes,
  formatarDuracao,
  formatarHora,
} from '../../jornada/formatacao';

interface PropsCartaoDia {
  dia: DiaJornadaDTO;
  /** Abre o formulário de ponto em atraso já com a data deste card. */
  aoLancarEmAtraso: (data: string) => void;
}

const LARGURA_DESTAQUE = espacamento[4];

function Marcacao({ rotulo, hora }: { rotulo: string; hora: string | null }) {
  return (
    <View style={{ gap: espacamento[2] }}>
      <Texto variante="labelSm" cor={cores.onSurfaceVariant}>
        {rotulo}
      </Texto>
      <Texto variante="titleMd" tabular>
        {formatarHora(hora)}
      </Texto>
    </View>
  );
}

/**
 * Um turno por linha, em ordem cronológica.
 *
 * O card mostrava só o menor início e o maior fim do dia, e com isso dois
 * turnos (10:00–15:00 e 16:00–18:00) apareciam como um único 10:00–18:00 —
 * o intervalo do meio sumia e o dia parecia uma hora mais longo do que foi.
 * Cada turno é um par entrada/saída próprio; o total do dia (no cabeçalho) é
 * a soma deles, não a distância entre as pontas.
 */
function LinhaTurno({
  jornada,
  estado,
  ordem,
}: {
  jornada: JornadaDTO;
  estado: EstadoJornada;
  /** `null` com um turno só: numerar e repetir a duração seria ruído. */
  ordem: number | null;
}) {
  const selos = (
    <>
      {estado === 'em_andamento' && <Badge variante="info" texto="Em andamento" />}
      {estado === 'vencida' && <Badge variante="erro" texto="Sem saída" />}
      {jornada.lancadoEmAtraso && <Badge variante="aviso" texto="Em atraso" />}
    </>
  );
  const temSelo = estado !== 'finalizada' || jornada.lancadoEmAtraso;

  return (
    <View style={{ gap: espacamento[8] }}>
      {(ordem !== null || temSelo) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: espacamento[8] }}>
          {ordem !== null && (
            <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
              {`${ordem}º TURNO`}
            </Texto>
          )}
          {selos}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: espacamento[24] }}>
        <Marcacao rotulo="ENT." hora={jornada.checkinAt} />
        <Marcacao rotulo="SAÍ." hora={jornada.checkoutAt} />
        <View style={{ flex: 1 }} />
        {ordem !== null && (
          <Texto variante="bodyMd" cor={cores.onSurfaceVariant} tabular>
            {formatarDuracao(minutosDaJornada(jornada))}
          </Texto>
        )}
      </View>
    </View>
  );
}

/**
 * Card de um dia do histórico (`HistoricoDePonto` do Stitch): dia em
 * destaque, total à direita e uma faixa lateral que diz o estado do dia sem
 * precisar ler os selos — erro para turno sem saída (é o que pede ação),
 * terciário para ponto lançado em atraso, primário para o dia regular.
 */
export function CartaoDia({ dia, aoLancarEmAtraso }: PropsCartaoDia) {
  const agoraIso = new Date().toISOString();

  // O histórico vem do mais recente para o mais antigo; dentro do dia a
  // ordem que o montador espera é a do relógio.
  const turnos = [...dia.jornadas]
    .sort((a, b) => (a.checkinAt ?? '').localeCompare(b.checkinAt ?? ''))
    .map((jornada) => ({ jornada, estado: estadoJornada(jornada, agoraIso) }));

  const semSaida = turnos.some(({ jornada }) => jornada.checkoutAt === null);
  const vencido = turnos.some(({ estado }) => estado === 'vencida');
  const comAtraso = turnos.some(({ jornada }) => jornada.lancadoEmAtraso);
  const destaque = vencido ? cores.error : comAtraso ? cores.tertiary : cores.primary;
  const variosTurnos = turnos.length > 1;

  return (
    <View
      testID="cartao-dia"
      style={[
        {
          borderRadius: raio.lg,
          backgroundColor: cores.surfaceContainerLowest,
          borderLeftWidth: LARGURA_DESTAQUE,
          borderLeftColor: destaque,
          padding: espacamentoNomeado.paddingCartao,
          gap: espacamento[16],
        },
        sombraPorNivel('elev1', Platform.OS === 'android' ? 'android' : 'ios'),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacamento[8] }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: espacamento[8] }}>
          <Texto variante="titleLg">{formatarDiaEMes(dia.data)}</Texto>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            {formatarDiaDaSemana(dia.data).toUpperCase()}
          </Texto>
        </View>
        <View style={{ alignItems: 'flex-end', gap: espacamento[2] }}>
          <Texto variante="labelSm" cor={cores.onSurfaceVariant}>
            TOTAL
          </Texto>
          <Texto variante="titleLg" tabular>
            {formatarDuracao(dia.minutosTrabalhados)}
          </Texto>
        </View>
      </View>

      {turnos.map(({ jornada, estado }, indice) => (
        <LinhaTurno
          key={jornada.id}
          jornada={jornada}
          estado={estado}
          ordem={variosTurnos ? indice + 1 : null}
        />
      ))}

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
  );
}
