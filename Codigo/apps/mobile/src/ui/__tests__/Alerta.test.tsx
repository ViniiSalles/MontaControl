import { render, screen } from '@testing-library/react-native';
import { Alerta } from '../Alerta';
import { cores } from '@montacontrol/design-tokens/native';

test('renderiza título e mensagem', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await render(<Alerta variante="info" titulo="Atenção" mensagem="Sessão expirada" />);
  expect(screen.getByText('Atenção')).toBeTruthy();
  expect(screen.getByText('Sessão expirada')).toBeTruthy();
});

test('omite o título quando não informado', async () => {
  await render(<Alerta variante="sucesso" mensagem="Tudo certo" />);
  expect(screen.queryByText('Atenção')).toBeNull();
  expect(screen.getByText('Tudo certo')).toBeTruthy();
});

test('usa a cor da variante erro', async () => {
  await render(<Alerta variante="erro" mensagem="Senha incorreta" />);
  const estilo = screen.getByTestId('alerta-container').props.style;
  expect(estilo.backgroundColor).toBe(cores.errorContainer);
});
