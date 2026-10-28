import { BackHandler } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AbaVisivelContext } from '../AbaVisivel';
import { useVoltarDoAndroid } from '../useVoltarDoAndroid';

afterEach(() => {
  jest.restoreAllMocks();
});

function comAbaVisivel(visivel: boolean) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <AbaVisivelContext.Provider value={visivel}>{children}</AbaVisivelContext.Provider>;
  };
}

test('aba oculta (notificações por cima) não registra o voltar do Android, mesmo ativo', async () => {
  const adicionar = jest.spyOn(BackHandler, 'addEventListener');

  await renderHook(() => useVoltarDoAndroid(true, jest.fn()), { wrapper: comAbaVisivel(false) });

  expect(adicionar).not.toHaveBeenCalled();
});

test('aba visível registra o voltar do Android quando ativo', async () => {
  const adicionar = jest.spyOn(BackHandler, 'addEventListener');

  await renderHook(() => useVoltarDoAndroid(true, jest.fn()), { wrapper: comAbaVisivel(true) });

  expect(adicionar).toHaveBeenCalledTimes(1);
});
