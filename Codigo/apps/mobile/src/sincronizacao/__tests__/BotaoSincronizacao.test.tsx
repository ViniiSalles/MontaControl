import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { BotaoSincronizacao } from '../BotaoSincronizacao';

const INICIO = Date.UTC(2026, 9, 18, 15, 0, 0);
const MINUTO = 60_000;

const aoSincronizar = jest.fn();

beforeEach(() => {
  jest.useFakeTimers({ now: INICIO });
  jest.clearAllMocks();
  useSincronizacaoStore.getState().reiniciar();
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: INICIO - 5 * MINUTO });
});

afterEach(() => {
  jest.useRealTimers();
});

const ponto = () => screen.queryByTestId('ponto-status-sincronizacao');
const abrirPainel = () => fireEvent.press(screen.getByLabelText(/^Sincronização:/));

test('em dia, o botão anuncia o status e não mostra o ponto de atenção', async () => {
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);

  expect(screen.getByLabelText('Sincronização: Sincronizado há 5 min')).toBeTruthy();
  expect(ponto()).toBeNull();
});

test('com ações na fila, o ponto de atenção aparece sobre o ícone', async () => {
  useSincronizacaoStore.setState({ pendentes: 2 });
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);

  expect(ponto()).toBeTruthy();
});

test('tocar abre o painel com a última sincronização e a fila; não sincroniza sozinho', async () => {
  useSincronizacaoStore.setState({ pendentes: 2 });
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);

  await abrirPainel();

  expect(screen.getByText('há 5 min')).toBeTruthy();
  expect(screen.getByText('2 registros')).toBeTruthy();
  expect(aoSincronizar).not.toHaveBeenCalled();
});

test('"Sincronizar agora" dispara a sincronização da tela e fecha o painel', async () => {
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);
  await abrirPainel();

  await fireEvent.press(screen.getByText('Sincronizar agora'));

  expect(aoSincronizar).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Sincronizar agora')).toBeNull();
});

test('sem conexão, o painel tranquiliza: os registros ficam guardados no aparelho', async () => {
  useSincronizacaoStore.setState({ online: false, pendentes: 1 });
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);
  await abrirPainel();

  expect(screen.getByText('1 registro')).toBeTruthy();
  expect(screen.getByText(/ficam guardados no aparelho/)).toBeTruthy();
});

test('nunca sincronizou: o painel diz isso em vez de inventar um horário', async () => {
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: null });
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);
  await abrirPainel();

  expect(screen.getByText('Ainda não sincronizou')).toBeTruthy();
});

test('o "há X" envelhece sozinho com o passar do tempo', async () => {
  await render(<BotaoSincronizacao aoSincronizar={aoSincronizar} />);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(5 * MINUTO);
  });

  expect(screen.getByLabelText('Sincronização: Sincronizado há 10 min')).toBeTruthy();
});
