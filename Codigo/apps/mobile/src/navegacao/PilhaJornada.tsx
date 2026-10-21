import { useCallback, useState } from 'react';
import { BancoHoras } from '../telas/BancoHoras';
import { Historico } from '../telas/Historico';
import { Jornada } from '../telas/Jornada';
import { ModalPontoEmAtraso } from '../telas/jornada/ModalPontoEmAtraso';
import { useVoltarDoAndroid } from './useVoltarDoAndroid';

type Vista = 'jornada' | 'historico' | 'bancoHoras';

/**
 * Navegação interna da aba Jornada: a tela de bater ponto, o histórico, o
 * banco de horas e o formulário de ponto em atraso por cima de qualquer uma
 * das três.
 *
 * É um `useState` e não uma biblioteca de navegação de propósito — a aba tem
 * três vistas (jornada, histórico, banco de horas) e uma folha modal, e
 * `BarraNavInferior` já resolve o nível de cima.
 */
export function PilhaJornada() {
  const [vista, setVista] = useState<Vista>('jornada');
  // `null` = folha fechada. Aberta, `data` é o dia que o card do histórico
  // mandou, ou `null` quando veio do botão solto da tela de jornada.
  const [pontoEmAtraso, setPontoEmAtraso] = useState<{ data: string | null } | null>(null);
  const voltarParaJornada = useCallback(() => setVista('jornada'), []);
  // A folha modal trata o próprio voltar (`onRequestClose`); aqui só as subtelas.
  useVoltarDoAndroid(vista !== 'jornada' && !pontoEmAtraso, voltarParaJornada);

  return (
    <>
      {vista === 'historico' ? (
        <Historico
          aoVoltar={voltarParaJornada}
          aoLancarEmAtraso={(data) => setPontoEmAtraso({ data })}
        />
      ) : vista === 'bancoHoras' ? (
        <BancoHoras aoVoltar={voltarParaJornada} />
      ) : (
        <Jornada
          aoAbrirHistorico={() => setVista('historico')}
          aoAbrirBancoHoras={() => setVista('bancoHoras')}
          aoLancarEmAtraso={() => setPontoEmAtraso({ data: null })}
        />
      )}

      {pontoEmAtraso && (
        <ModalPontoEmAtraso dataInicial={pontoEmAtraso.data} aoFechar={() => setPontoEmAtraso(null)} />
      )}
    </>
  );
}
