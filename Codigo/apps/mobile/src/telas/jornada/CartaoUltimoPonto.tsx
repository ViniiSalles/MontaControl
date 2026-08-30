import { View } from 'react-native';
import { cores, espacamento } from '@montacontrol/design-tokens/native';
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

/**
 * Cartão de leitura do último registro: hora em destaque, tipo/dia logo
 * abaixo e o mapa do lugar onde o ponto caiu. O mapa só aparece com
 * coordenada — ponto lançado em atraso nasce sem GPS (`JornadaDTO.lancadoEmAtraso`).
 */
export function CartaoUltimoPonto({ ponto }: PropsCartaoUltimoPonto) {
  if (!ponto) return <CartaoVazio />;

  const emAndamento = ponto.tipo === 'entrada';
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
            {emAndamento ? (
              <Badge variante="info" texto="Em andamento" />
            ) : (
              <Badge variante="neutro" texto="Encerrada" />
            )}
            {ponto.lancadoEmAtraso && <Badge variante="aviso" texto="Em atraso" />}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
            {emAndamento && <PulsoAtividade />}
            <Texto variante="displaySm" tabular>
              {formatarHora(ponto.registradoEm)}
            </Texto>
          </View>

          <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
            {`${rotuloExibido[ponto.tipo]} · ${formatarDiaCurto(diaCivilDe(ponto.registradoEm))}`}
          </Texto>

          {latitude !== null && longitude !== null && (
            <MapaLocalizacao latitude={latitude} longitude={longitude} endereco={ponto.endereco} />
          )}
        </View>
      }
    />
  );
}
