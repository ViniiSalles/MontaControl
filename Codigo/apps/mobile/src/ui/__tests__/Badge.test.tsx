import { render, screen } from '@testing-library/react-native';
import { Badge } from '../Badge';
import { cores } from '@montacontrol/design-tokens/native';

test('uppercase o texto', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await render(<Badge variante="sucesso" texto="ativo" />);
  expect(screen.getByText('ATIVO')).toBeTruthy();
});

test('usa a cor da variante erro', async () => {
  await render(<Badge variante="erro" texto="bloqueado" />);
  const estilo = screen.getByTestId('badge-container').props.style;
  expect(estilo.backgroundColor).toBe(cores.errorContainer);
});

test('usa a cor da variante neutro', async () => {
  await render(<Badge variante="neutro" texto="pendente" />);
  const estilo = screen.getByTestId('badge-container').props.style;
  expect(estilo.backgroundColor).toBe(cores.surfaceContainerHigh);
});
