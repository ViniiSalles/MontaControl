import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsTela } from '@montacontrol/ui-contracts/tela';
import { cores, espacamentoNomeado } from '@montacontrol/design-tokens/native';

/**
 * `testID` fixo, só para o teste deste componente localizar o
 * `KeyboardAvoidingView` — Test Renderer (RNTL v14) só expõe elementos host
 * na árvore, então não há mais como consultar por tipo de composite
 * component (`UNSAFE_getByType` foi removido); ver Task 4/Task 8 e
 * `docs/guides/migration-v14.md` do pacote instalado.
 */
const TESTID_EVITAR_TECLADO = 'tela-keyboard-avoiding-view';

export function Tela({ children, evitarTeclado = false, rolavel = false }: PropsTela) {
  const Conteudo = rolavel ? ScrollView : View;
  const miolo = (
    <Conteudo
      style={{ flex: 1, padding: espacamentoNomeado.paddingTelaMobile, backgroundColor: cores.background }}
    >
      {children}
    </Conteudo>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: cores.background }}>
      {evitarTeclado ? (
        <KeyboardAvoidingView
          testID={TESTID_EVITAR_TECLADO}
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {miolo}
        </KeyboardAvoidingView>
      ) : (
        miolo
      )}
    </SafeAreaView>
  );
}
