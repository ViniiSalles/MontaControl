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

const texto = () => screen.getByTestId('indicador-sincronizacao');

test('reflete o store: sem conexão com ações na fila', async () => {
  await render(<IndicadorDeSincronizacao />);
  await act(async () => {
    useSincronizacaoStore.setState({ online: false, pendentes: 2 });
  });

  expect(screen.getByText('Sem conexão · 2 pendentes')).toBeTruthy();
});

test('acompanha as mudanças do store sem remontar', async () => {
  await render(<IndicadorDeSincronizacao />);
  await act(async () => {
    useSincronizacaoStore.setState({ ultimaSincronizacaoEm: INICIO });
  });
  expect(screen.getByText('Sincronizado agora')).toBeTruthy();

  await act(async () => {
    useSincronizacaoStore.setState({ sincronizando: true });
  });
  expect(screen.getByText('Sincronizando…')).toBeTruthy();

  await act(async () => {
    useSincronizacaoStore.setState({ sincronizando: false, ultimoErro: 'falha' });
  });
  expect(screen.getByText('Falha ao sincronizar')).toBeTruthy();
});

test('o "há X" envelhece sozinho com o passar do tempo', async () => {
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: INICIO });
  await render(<IndicadorDeSincronizacao />);
  expect(screen.getByText('Sincronizado agora')).toBeTruthy();

  await act(async () => {
    await jest.advanceTimersByTimeAsync(5 * 60_000);
  });

  expect(screen.getByText('Sincronizado há 5 min')).toBeTruthy();
});

test('é um aviso de status acessível (região viva educada) e some o intervalo ao desmontar', async () => {
  const limpar = jest.spyOn(globalThis, 'clearInterval');
  const { unmount } = await render(<IndicadorDeSincronizacao />);
  expect(texto().props.accessibilityLiveRegion).toBe('polite');

  await unmount();

  expect(limpar).toHaveBeenCalled();
});
