import { useState } from 'react';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { cores } from '@montacontrol/design-tokens/native';
import { BarraNavInferior } from '../ui/BarraNavInferior';
import { Jornada } from '../telas/Jornada';
import { ABA_PADRAO, ABAS } from './abas';
import type { IdAba } from './abas';

/**
 * Casca do app autenticado: conteúdo da aba + barra inferior fixa.
 *
 * A Sprint 1 tem uma única aba disponível, então `telaPorAba` tem um só
 * registro. É deliberado que ele seja um mapa e não um `if`: cada sprint
 * seguinte acrescenta uma linha aqui e vira `disponivel: true` em
 * `abas.ts`, sem reescrever a navegação.
 */
const telaPorAba: Partial<Record<IdAba, ComponentType>> = {
  jornada: Jornada,
};

export function AppAutenticado() {
  const [abaAtiva, setAbaAtiva] = useState<IdAba>(ABA_PADRAO);

  // Aba sem tela entregue cai na padrão, que sempre existe — a barra já as
  // mantém desabilitadas, então isto é rede de segurança, não fluxo normal.
  const TelaAtiva = telaPorAba[abaAtiva] ?? Jornada;

  const itens = ABAS.map((aba) => ({
    rotulo: aba.rotulo,
    icone: aba.icone,
    ativo: aba.id === abaAtiva,
    desabilitado: !aba.disponivel,
    aoPressionar: () => setAbaAtiva(aba.id),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: cores.background }}>
      <View style={{ flex: 1 }}>
        <TelaAtiva />
      </View>
      <BarraNavInferior itens={itens} />
    </View>
  );
}
