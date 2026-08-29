import { render, screen } from '@testing-library/react-native';
import { Texto } from '../Texto';

test.each([
  ['bodyMd', 'Inter_400Regular'],
  ['titleLg', 'Inter_700Bold'],
  ['headlineLg', 'Inter_800ExtraBold'],
] as const)('variante %s usa a família %s', async (variante, familiaEsperada) => {
  // `render` é assíncrono a partir do @testing-library/react-native v13 —
  // a versão ^14 resolvida pelo `expo install` do Task 4 exige `await`,
  // mesmo que o snippet original do plano não mostrasse isso (ver
  // ledger do Task 4 e Codigo/apps/mobile/src/ui/__tests__/harness.smoke.test.tsx).
  await render(<Texto variante={variante}>conteúdo</Texto>);
  const elemento = screen.getByText('conteúdo');
  const estilo = Array.isArray(elemento.props.style) ? Object.assign({}, ...elemento.props.style) : elemento.props.style;
  expect(estilo.fontFamily).toBe(familiaEsperada);
  expect(estilo.fontWeight).toBeUndefined();
});
