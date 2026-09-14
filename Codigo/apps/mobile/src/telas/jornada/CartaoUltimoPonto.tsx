import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cores, espacamento, raio } from '@montacontrol/design-tokens/native';
import { LIMITE_JORNADA_HORAS } from '@montacontrol/shared';
import type { EstadoJornada, JornadaDTO } from '@montacontrol/shared';
import { Badge } from '../../ui/Badge';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { MapaLocalizacao } from '../../ui/MapaLocalizacao';
import { PulsoAtividade } from '../../ui/PulsoAtividade';
import { Texto } from '../../ui/Texto';
import { formatarHora } from '../../jornada/formatacao';
import { derivarUltimoPonto } from '../../jornada/ultimoPonto';

interface PropsCartaoUltimoPonto {
  /** `null` = montador ainda não bateu nenhum ponto na jornada corrente. */
  jornada: JornadaDTO | null;
  /** Estado da jornada — decide o selo, o item pendente e o aviso. */
  estado: EstadoJornada;
  /** Há ação de jornada na fila de sincronização (issue #18). */
  pendenteSincronizacao?: boolean;
}

function Cabecalho({ filho }: { filho?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[8] }}>
      <Icone nome="history" tamanho={espacamento[16]} cor={cores.onSurfaceVariant} />
      <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
        MARCAÇÕES DE HOJE
      </Texto>
      <View style={{ flex: 1 }} />
      {filho}
    </View>
  );
}

function CartaoVazio() {
  return (
    <Cartao
      elevacao="elev2"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[12] }}>
          <Cabecalho />
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

interface PropsLinhaMarcacao {
  rotulo: string;
  descricao: string;
  hora: string | null;
  concluido: boolean;
  /** Só o próximo item pendente pulsa — os demais ficam parados. */
  pulsando: boolean;
}

function LinhaMarcacao({ rotulo, descricao, hora, concluido, pulsando }: PropsLinhaMarcacao) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacamento[12] }}>
      <View
        style={{
          width: espacamento[24],
          height: espacamento[24],
          borderRadius: raio.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: concluido ? cores.primary : cores.surfaceContainerHigh,
          borderWidth: concluido ? 0 : 2,
          borderColor: cores.primary,
        }}
      >
        {concluido ? (
          <Icone nome="check" tamanho={espacamento[16]} cor={cores.onPrimary} preenchido />
        ) : pulsando ? (
          <PulsoAtividade />
        ) : null}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ opacity: concluido ? 1 : 0.6 }}>
          <Texto variante="titleSm">{rotulo}</Texto>
          <Texto variante="bodySm" cor={cores.onSurfaceVariant}>
            {descricao}
          </Texto>
        </View>
        <Texto variante="titleMd" tabular>
          {hora ?? '—:—'}
        </Texto>
      </View>
    </View>
  );
}

/**
 * Cartão "MARCAÇÕES DE HOJE" (`jornada_home:110-160`): linha do tempo com
 * entrada e saída do dia, selo de estado e o mapa do último ponto batido.
 * Com só check-in, a saída aparece como próximo item pendente — pulsando
 * quando a jornada ainda está em curso, parada quando já venceu (o aviso
 * abaixo explica o que fazer nesse caso).
 */
export function CartaoUltimoPonto({
  jornada,
  estado,
  pendenteSincronizacao = false,
}: PropsCartaoUltimoPonto) {
  if (!jornada) return <CartaoVazio />;

  const ultimoPonto = derivarUltimoPonto(jornada);
  // Desestruturar antes do JSX é o que faz o TS estreitar `number | null`
  // para `number` dentro do bloco condicional do mapa.
  const latitude = ultimoPonto?.latitude ?? null;
  const longitude = ultimoPonto?.longitude ?? null;

  return (
    <Cartao
      elevacao="elev2"
      tom="padrao"
      conteudo={
        <View style={{ gap: espacamento[16] }}>
          <Cabecalho
            filho={
              <View style={{ flexDirection: 'row', gap: espacamento[6] }}>
                {pendenteSincronizacao && <Badge variante="neutro" texto="Sincronizando" />}
                <SeloEstado estado={estado} />
                {jornada.lancadoEmAtraso && <Badge variante="aviso" texto="Em atraso" />}
              </View>
            }
          />

          <View style={{ gap: espacamento[16] }}>
            <LinhaMarcacao
              rotulo="Entrada"
              descricao="Início do expediente"
              hora={formatarHora(jornada.checkinAt)}
              concluido={!!jornada.checkinAt}
              pulsando={false}
            />
            <LinhaMarcacao
              rotulo="Saída"
              descricao={jornada.checkoutAt ? 'Fim do expediente' : 'Pendente'}
              hora={jornada.checkoutAt ? formatarHora(jornada.checkoutAt) : null}
              concluido={!!jornada.checkoutAt}
              pulsando={!jornada.checkoutAt && estado === 'em_andamento'}
            />
          </View>

          {estado === 'vencida' && (
            <Texto variante="bodyMd" cor={cores.error}>
              {`Esta entrada passou de ${LIMITE_JORNADA_HORAS}h sem saída. Registre a saída pelo ponto em atraso — a próxima batida abre uma jornada nova.`}
            </Texto>
          )}

          {latitude !== null && longitude !== null && (
            <MapaLocalizacao latitude={latitude} longitude={longitude} endereco={ultimoPonto?.endereco} />
          )}
        </View>
      }
    />
  );
}
