import { useState } from 'react';
import { View } from 'react-native';
import { cores, espacamento, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import type { PeriodoHistorico } from '@montacontrol/shared';
import { Alerta } from '../ui/Alerta';
import { Botao } from '../ui/Botao';
import { Carregando } from '../ui/Carregando';
import { Cartao } from '../ui/Cartao';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';
import { formatarDuracao } from '../jornada/formatacao';
import { useHistoricoPontos } from '../jornada/useHistoricoPontos';
import { CartaoDia } from './jornada/CartaoDia';
import { SeletorPeriodo } from './jornada/SeletorPeriodo';

interface PropsHistorico {
  aoVoltar: () => void;
  /** Abre o formulário de ponto em atraso já com o dia do card. */
  aoLancarEmAtraso: (data: string) => void;
}

const PERIODO_PADRAO: PeriodoHistorico = 15;

/**
 * Histórico de pontos do período escolhido. Dia sem check-out ganha, no
 * próprio card, o atalho para o ponto em atraso — é ali que o montador
 * percebe o registro que faltou.
 */
export function Historico({ aoVoltar, aoLancarEmAtraso }: PropsHistorico) {
  const [periodo, setPeriodo] = useState<PeriodoHistorico>(PERIODO_PADRAO);
  const { dias, totalMinutos, carregando, erro, recarregar } = useHistoricoPontos(periodo);

  return (
    <Tela rolavel>
      <View style={{ gap: espacamentoNomeado.gapPilha }}>
        <View style={{ gap: espacamento[4] }}>
          <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
            JORNADA
          </Texto>
          <Texto variante="headlineMd">Histórico de pontos</Texto>
        </View>

        <SeletorPeriodo periodo={periodo} aoTrocar={setPeriodo} />

        <Cartao
          elevacao="elev1"
          tom="baixo"
          conteudo={
            <View style={{ gap: espacamento[4] }}>
              <Texto variante="labelMd" cor={cores.onSurfaceVariant}>
                TOTAL NO PERÍODO
              </Texto>
              <Texto variante="headlineSm" tabular>
                {formatarDuracao(totalMinutos)}
              </Texto>
            </View>
          }
        />

        {carregando ? (
          <View style={{ alignItems: 'center', paddingVertical: espacamento[32] }}>
            <Carregando tamanho={espacamento[32]} />
          </View>
        ) : erro ? (
          <>
            <Alerta
              variante="erro"
              titulo="Não foi possível carregar o histórico"
              mensagem="Verifique a internet e tente de novo."
            />
            <Botao
              variante="tonal"
              tamanho={48}
              forma="pilula"
              texto="Tentar de novo"
              larguraTotal
              aoPressionar={() => void recarregar()}
            />
          </>
        ) : dias.length === 0 ? (
          <Cartao
            elevacao="elev1"
            tom="padrao"
            conteudo={
              <View style={{ gap: espacamento[8] }}>
                <Texto variante="titleLg">Nenhum ponto no período</Texto>
                <Texto variante="bodyMd" cor={cores.onSurfaceVariant}>
                  Troque o período acima ou lance um ponto em atraso.
                </Texto>
              </View>
            }
          />
        ) : (
          <View style={{ gap: espacamento[12] }}>
            {dias.map((dia) => (
              <CartaoDia key={dia.data} dia={dia} aoLancarEmAtraso={aoLancarEmAtraso} />
            ))}
          </View>
        )}

        <Botao
          variante="fantasma"
          tamanho={48}
          forma="pilula"
          texto="Voltar"
          larguraTotal
          aoPressionar={aoVoltar}
        />
      </View>
    </Tela>
  );
}
