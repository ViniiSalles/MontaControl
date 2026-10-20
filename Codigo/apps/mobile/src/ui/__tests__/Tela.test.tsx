import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ComBarraInferior, Tela } from '../Tela';
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

// Dentro das abas a tela termina acima da barra inferior: reservar o
// indicador de gestos ali abria uma faixa vazia entre o conteúdo e a barra.
test('fora das abas reserva todas as bordas do aparelho', async () => {
  await renderComSafeArea(
    <Tela>
      <Texto variante="bodyMd">conteúdo</Texto>
    </Tela>,
  );
  expect(screen.getByTestId('tela-area-segura').props.edges).toEqual(
    expect.objectContaining({ bottom: 'additive' }),
  );
});

test('acima da barra inferior não reserva a borda de baixo', async () => {
  await renderComSafeArea(
    <ComBarraInferior>
      <Tela>
        <Texto variante="bodyMd">conteúdo</Texto>
      </Tela>
    </ComBarraInferior>,
  );
  expect(screen.getByTestId('tela-area-segura').props.edges).toEqual(
    expect.objectContaining({ bottom: 'off' }),
  );
});
