import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
import { LIMITE_JORNADA_HORAS } from '@montacontrol/shared';
import type { EstadoJornada } from '@montacontrol/shared';
import { Badge } from '../../ui/Badge';
import { Cartao } from '../../ui/Cartao';
import { MapaLocalizacao } from '../../ui/MapaLocalizacao';
import { PulsoAtividade } from '../../ui/PulsoAtividade';
import { Texto } from '../../ui/Texto';
import { diaCivilDe, formatarDiaCurto, formatarHora } from '../../jornada/formatacao';
import type { TipoPonto, UltimoPonto } from '../../jornada/ultimoPonto';

const rotuloExibido: Record<TipoPonto, string> = { entrada: 'Entrada', saida: 'Saída' };

interface PropsCartaoUltimoPonto {
  /** `null` = montador ainda não bateu nenhum ponto na jornada corrente. */
  ponto: UltimoPonto | null;
  /** Estado da jornada a que o ponto pertence — decide o selo e o aviso. */
  estado: EstadoJornada;
}

function CartaoVazio() {
  return (
    <Cartao
      elevacao="elev2"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[8] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            ÚLTIMO PONTO
          </Texto>
          <Texto variante="titleLg">Nenhum ponto registrado</Texto>
          <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
            Registre a entrada para iniciar sua jornada de hoje.
          </Texto>
        </View>
      }
    />
  );
}

function SeloEstado({ estado }: { estado: EstadoJornada }) {
  if (estado === 'em_andamento') return <Badge variante="info" texto="Em andamento" />;
  if (estado === 'vencida') return <Badge variante="erro" texto="Sem saída" />;
  return <Badge variante="neutro" texto="Encerrada" />;
}

/**
 * Cartão de leitura do último registro: hora em destaque, tipo/dia logo
 * abaixo e o mapa do lugar onde o ponto caiu. O mapa só aparece com
 * coordenada — ponto lançado em atraso nasce sem GPS (`JornadaDTO.lancadoEmAtraso`).
 */
export function CartaoUltimoPonto({ ponto, estado }: PropsCartaoUltimoPonto) {
  if (!ponto) return <CartaoVazio />;

  // Desestruturar antes do JSX é o que faz o TS estreitar `number | null`
  // para `number` dentro do bloco condicional do mapa.
  const { latitude, longitude } = ponto;

  return (
    <Cartao
      elevacao="elev2"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[12] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
            <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
              ÚLTIMO PONTO
            </Texto>
            <View style={{ flex: 1 }} />
            <SeloEstado estado={estado} />
            {ponto.lancadoEmAtraso && <Badge variante="aviso" texto="Em atraso" />}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
            {estado === 'em_andamento' && <PulsoAtividade />}
            <Texto variante="displaySm" tabular>
              {formatarHora(ponto.registradoEm)}
            </Texto>
          </View>

          <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
            {`${rotuloExibido[ponto.tipo]} · ${formatarDiaCurto(diaCivilDe(ponto.registradoEm))}`}
          </Texto>

          {estado === 'vencida' && (
            <Texto variante="bodyMd" cor={cores.error}>
              {`Esta entrada passou de ${LIMITE_JORNADA_HORAS}h sem saída. Registre a saída pelo ponto em atraso — a próxima batida abre uma jornada nova.`}
            </Texto>
          )}

          {latitude !== null && longitude !== null && (
            <MapaLocalizacao latitude={latitude} longitude={longitude} endereco={ponto.endereco} />
          )}
        </View>
      }
    />
  );
}
