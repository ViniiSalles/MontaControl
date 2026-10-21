import { act, render, screen } from '@testing-library/react-native';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { IndicadorDeSincronizacao } from '../IndicadorDeSincronizacao';

const INICIO = Date.UTC(2026, 9, 18, 15, 0, 0);

beforeEach(() => {
  jest.useFakeTimers({ now: INICIO });
  useSincronizacaoStore.getState().reiniciar();
});

afterEach(() => {
  jest.useRealTimers();
});

const faixa = () => screen.queryByTestId('indicador-sincronizacao');

test('em dia, a faixa não ocupa espaço na tela', async () => {
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: INICIO });
  await render(<IndicadorDeSincronizacao />);

  expect(faixa()).toBeNull();
});

test('com fila e rede, a faixa continua escondida (a fila sobe sozinha)', async () => {
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: INICIO, pendentes: 2 });
  await render(<IndicadorDeSincronizacao />);

  expect(faixa()).toBeNull();
});

test('reflete o store: sem conexão com ações na fila', async () => {
  await render(<IndicadorDeSincronizacao />);
  await act(async () => {
    useSincronizacaoStore.setState({ online: false, pendentes: 2 });
  });

  expect(screen.getByText('Sem conexão · 2 pendentes')).toBeTruthy();
});

test('aparece com o erro, segue visível na nova tentativa e some quando ela dá certo', async () => {
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: INICIO });
  await render(<IndicadorDeSincronizacao />);
  expect(faixa()).toBeNull();

  await act(async () => {
    useSincronizacaoStore.setState({ ultimoErro: 'falha' });
  });
  expect(screen.getByText('Falha ao sincronizar')).toBeTruthy();

  await act(async () => {
    useSincronizacaoStore.setState({ sincronizando: true });
  });
  expect(screen.getByText('Sincronizando…')).toBeTruthy();

  await act(async () => {
    useSincronizacaoStore.setState({ sincronizando: false, ultimoErro: null });
  });
  expect(faixa()).toBeNull();
});

test('é um aviso de status acessível (região viva educada)', async () => {
  useSincronizacaoStore.setState({ online: false });
  await render(<IndicadorDeSincronizacao />);

  expect(faixa()?.props.accessibilityLiveRegion).toBe('polite');
});
