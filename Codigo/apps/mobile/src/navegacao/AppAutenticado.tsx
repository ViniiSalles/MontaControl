import { useCallback, useState } from 'react';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { cores } from '@montacontrol/design-tokens/native';
import { BarraNavInferior } from '../ui/BarraNavInferior';
import { ComBarraInferior } from '../ui/Tela';
import { Atestados } from '../telas/Atestados';
import { Avarias } from '../telas/Avarias';
import { Bipagem } from '../telas/Bipagem';
import { Notificacoes } from '../telas/Notificacoes';
import { IndicadorDeSincronizacao } from '../sincronizacao/IndicadorDeSincronizacao';
import { useSincronizacaoDoApp } from '../sincronizacao/useSincronizacaoDoApp';
import { useSocketDoApp } from '../sincronizacao/useSocketDoApp';
import { AbaVisivelContext } from './AbaVisivel';
import { PilhaJornada } from './PilhaJornada';
import { useVoltarDoAndroid } from './useVoltarDoAndroid';
import { ABA_PADRAO, ABAS } from './abas';
import type { IdAba } from './abas';
import type { PropsTelaDaAba } from './telaDaAba';

/**
 * Casca do app autenticado: conteúdo da aba + barra inferior fixa.
 *
 * Cada sprint acrescenta uma linha aqui e vira `disponivel: true` em
 * `abas.ts`, sem reescrever a navegação.
 *
 * A sincronização vive acima das abas (`useSincronizacaoDoApp`): só a aba
 * ativa está montada, então ligá-la numa tela deixaria as outras sem gatilho.
 * Este componente só existe com sessão, logo o logout o desmonta e desliga os
 * listeners.
 */
const telaPorAba: Partial<Record<IdAba, ComponentType<PropsTelaDaAba>>> = {
  jornada: PilhaJornada,
  bipagem: Bipagem,
  avarias: Avarias,
  atestados: Atestados,
};

export function AppAutenticado() {
  useSincronizacaoDoApp();
  useSocketDoApp();
  const [abaAtiva, setAbaAtiva] = useState<IdAba>(ABA_PADRAO);
  // A tela de notificações fica por cima da aba ativa, sem trocá-la: a aba só é escondida (continua
  // montada), então o que o montador digitou e as fotos anexadas sobrevivem a abrir e fechar.
  const [notificacoesAberta, setNotificacoesAberta] = useState(false);
  const fecharNotificacoes = useCallback(() => setNotificacoesAberta(false), []);
  useVoltarDoAndroid(notificacoesAberta, fecharNotificacoes);

  function irParaAba(aba: IdAba) {
    setAbaAtiva(aba);
    setNotificacoesAberta(false);
  }

  // Aba sem tela entregue cai na padrão, que sempre existe — a barra já as
  // mantém desabilitadas, então isto é rede de segurança, não fluxo normal.
  const TelaAtiva = telaPorAba[abaAtiva] ?? PilhaJornada;

  const itens = ABAS.map((aba) => ({
    rotulo: aba.rotulo,
    icone: aba.icone,
    ativo: aba.id === abaAtiva,
    desabilitado: !aba.disponivel,
    aoPressionar: () => irParaAba(aba.id),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: cores.background }}>
      <View style={{ flex: 1 }}>
        <ComBarraInferior>
          <View style={{ flex: 1, display: notificacoesAberta ? 'none' : 'flex' }}>
            <AbaVisivelContext.Provider value={!notificacoesAberta}>
              <TelaAtiva
                aoIrParaJornada={() => setAbaAtiva('jornada')}
                aoAbrirNotificacoes={() => setNotificacoesAberta(true)}
              />
            </AbaVisivelContext.Provider>
          </View>
          {notificacoesAberta && <Notificacoes aoVoltar={fecharNotificacoes} aoAbrirAba={irParaAba} />}
        </ComBarraInferior>
      </View>
      {/* Acima da barra, fora do conteúdo da aba: o mesmo status em todas as telas. */}
      <IndicadorDeSincronizacao />
      <BarraNavInferior itens={itens} />
    </View>
  );
}
