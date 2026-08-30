import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Historico } from '../telas/Historico';
import { Jornada } from '../telas/Jornada';
import { ModalPontoEmAtraso } from '../telas/jornada/ModalPontoEmAtraso';

type Vista = 'jornada' | 'historico';

/**
 * Navegação interna da aba Jornada: a tela de bater ponto, o histórico e o
 * formulário de ponto em atraso por cima de qualquer uma das duas.
 *
 * É um `useState` e não uma biblioteca de navegação de propósito — a aba tem
 * duas vistas e uma folha modal, e `BarraNavInferior` já resolve o nível de
 * cima. Se surgir uma terceira vista com histórico de voltar, aí sim vale a
 * troca.
 */
export function PilhaJornada() {
  const { sessao } = useAuth();
  const token = sessao?.accessToken ?? '';

  const [vista, setVista] = useState<Vista>('jornada');
  // `null` = folha fechada. Aberta, `data` é o dia que o card do histórico
  // mandou, ou `null` quando veio do botão solto da tela de jornada.
  const [pontoEmAtraso, setPontoEmAtraso] = useState<{ data: string | null } | null>(null);

  return (
    <>
      {vista === 'historico' ? (
        <Historico
          aoVoltar={() => setVista('jornada')}
          aoLancarEmAtraso={(data) => setPontoEmAtraso({ data })}
        />
      ) : (
        <Jornada
          aoAbrirHistorico={() => setVista('historico')}
          aoLancarEmAtraso={() => setPontoEmAtraso({ data: null })}
        />
      )}

      {pontoEmAtraso && (
        <ModalPontoEmAtraso
          token={token}
          dataInicial={pontoEmAtraso.data}
          aoFechar={() => setPontoEmAtraso(null)}
        />
      )}
    </>
  );
}
