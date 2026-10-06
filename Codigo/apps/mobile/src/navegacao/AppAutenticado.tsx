import { useState } from 'react';
import type { ComponentType } from 'react';
import { View } from 'react-native';
import { cores } from '@montacontrol/design-tokens/native';
import { BarraNavInferior } from '../ui/BarraNavInferior';
import { Atestados } from '../telas/Atestados';
import { Avarias } from '../telas/Avarias';
import { PilhaJornada } from './PilhaJornada';
import { ABA_PADRAO, ABAS } from './abas';
import type { IdAba } from './abas';

/**
 * Casca do app autenticado: conteúdo da aba + barra inferior fixa.
 *
 * Cada sprint acrescenta uma linha aqui e vira `disponivel: true` em
 * `abas.ts`, sem reescrever a navegação.
 */
const telaPorAba: Partial<Record<IdAba, ComponentType>> = {
  jornada: PilhaJornada,
  avarias: Avarias,
  atestados: Atestados,
};

export function AppAutenticado() {
  const [abaAtiva, setAbaAtiva] = useState<IdAba>(ABA_PADRAO);

  // Aba sem tela entregue cai na padrão, que sempre existe — a barra já as
  // mantém desabilitadas, então isto é rede de segurança, não fluxo normal.
  const TelaAtiva = telaPorAba[abaAtiva] ?? PilhaJornada;

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
