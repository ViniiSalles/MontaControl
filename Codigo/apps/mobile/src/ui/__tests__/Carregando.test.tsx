import { render, screen } from '@testing-library/react-native';
import { Carregando } from '../Carregando';
import { cores } from '@montacontrol/design-tokens/native';

test('renderiza o ActivityIndicator com a cor primária', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await render(<Carregando />);
  const indicador = screen.getByTestId('carregando-spinner');
  expect(indicador).toBeTruthy();
  expect(indicador.props.color).toBe(cores.primary);
});

test('aceita tamanho customizado', async () => {
  await render(<Carregando tamanho={40} />);
  expect(screen.getByTestId('carregando-spinner').props.size).toBe(40);
});
