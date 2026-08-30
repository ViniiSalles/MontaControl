import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Tela } from '../Tela';
import { Texto } from '../Texto';

function renderComSafeArea(ui: ReactElement) {
  return render(<SafeAreaProvider>{ui}</SafeAreaProvider>);
}

test('evitarTeclado monta KeyboardAvoidingView', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await renderComSafeArea(
    <Tela evitarTeclado>
      <Texto variante="bodyMd">conteúdo</Texto>
    </Tela>,
  );
  // `UNSAFE_getByType` (usado no snippet original do plano) foi removido no
  // RNTL v14 — Test Renderer só expõe elementos host na árvore, não há mais
  // como consultar por tipo de composite component (ver
  // `docs/guides/migration-v14.md` do pacote instalado, seção "Legacy
  // UNSAFE_* queries removed"). `Tela.tsx` expõe um `testID` fixo só para
  // este teste localizar o `KeyboardAvoidingView`.
  expect(screen.getByTestId('tela-keyboard-avoiding-view')).toBeTruthy();
  expect(screen.getByText('conteúdo')).toBeTruthy();
});

test('sem evitarTeclado não monta KeyboardAvoidingView', async () => {
  await renderComSafeArea(
    <Tela>
      <Texto variante="bodyMd">conteúdo</Texto>
    </Tela>,
  );
  expect(screen.queryByTestId('tela-keyboard-avoiding-view')).toBeNull();
});
