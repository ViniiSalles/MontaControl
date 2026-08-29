import { ActivityIndicator } from 'react-native';
import type { PropsCarregando } from '@montacontrol/ui-contracts/carregando';
import { cores, espacamentoNomeado } from '@montacontrol/design-tokens/native';

export function Carregando({ tamanho = espacamentoNomeado.gradeIcone }: PropsCarregando) {
  return <ActivityIndicator testID="carregando-spinner" size={tamanho} color={cores.primary} />;
}
