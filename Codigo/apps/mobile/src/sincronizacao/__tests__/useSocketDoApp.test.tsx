jest.mock('../iniciarSocket');

import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { iniciarSocket } from '../iniciarSocket';
import { useSocketDoApp } from '../useSocketDoApp';

const iniciarMock = jest.mocked(iniciarSocket);
const pararMock = jest.fn();

let database = criarBancoDeTeste();

function envolver({ children }: { children: ReactNode }) {
  return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  iniciarMock.mockReturnValue(pararMock);
});

test('liga o socket uma única vez, com o banco do provider', async () => {
  const { rerender } = await renderHook(() => useSocketDoApp(), { wrapper: envolver });
  await rerender({});

  expect(iniciarMock).toHaveBeenCalledTimes(1);
  expect(iniciarMock).toHaveBeenCalledWith(database);
  expect(pararMock).not.toHaveBeenCalled();
});

test('desliga o socket ao desmontar', async () => {
  const { unmount } = await renderHook(() => useSocketDoApp(), { wrapper: envolver });

  await unmount();

  expect(pararMock).toHaveBeenCalledTimes(1);
});
