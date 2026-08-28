import { render, screen, fireEvent } from '@testing-library/react-native';
import { Botao } from '../Botao';

test('dispara aoPressionar ao tocar', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  const aoPressionar = jest.fn();
  await render(<Botao variante="primario" tamanho={56} forma="pilula" texto="Entrar" aoPressionar={aoPressionar} />);
  fireEvent.press(screen.getByText('Entrar'));
  expect(aoPressionar).toHaveBeenCalledTimes(1);
});

test('desabilitado não dispara aoPressionar', async () => {
  const aoPressionar = jest.fn();
  await render(
    <Botao variante="primario" tamanho={56} forma="pilula" texto="Entrar" desabilitado aoPressionar={aoPressionar} />,
  );
  fireEvent.press(screen.getByText('Entrar'));
  expect(aoPressionar).not.toHaveBeenCalled();
});

test('carregando não dispara aoPressionar e troca o conteúdo pelo spinner', async () => {
  const aoPressionar = jest.fn();
  await render(
    <Botao variante="primario" tamanho={56} forma="pilula" texto="Entrar" carregando aoPressionar={aoPressionar} />,
  );
  expect(screen.queryByText('Entrar')).toBeNull();
  fireEvent.press(screen.getByTestId('botao-pressable'));
  expect(aoPressionar).not.toHaveBeenCalled();
});
