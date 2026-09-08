import { fireEvent, render, screen } from '@testing-library/react-native';
import { BotaoAcaoPrincipal } from '../BotaoAcaoPrincipal';

test('dispara aoPressionar ao tocar', async () => {
  const aoPressionar = jest.fn();
  await render(<BotaoAcaoPrincipal texto="Bater ponto de entrada" aoPressionar={aoPressionar} />);

  fireEvent.press(screen.getByText('Bater ponto de entrada'));

  expect(aoPressionar).toHaveBeenCalledTimes(1);
});

test('carregando não dispara aoPressionar e troca o ícone pelo spinner', async () => {
  const aoPressionar = jest.fn();
  await render(<BotaoAcaoPrincipal texto="Bater ponto de saída" carregando aoPressionar={aoPressionar} />);

  fireEvent.press(screen.getByTestId('botao-acao-principal'));

  expect(aoPressionar).not.toHaveBeenCalled();
  expect(screen.getByText('Bater ponto de saída')).toBeTruthy();
});
