jest.mock('../syncManager');

import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { AcaoPendente } from '../../db/AcaoPendente';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { iniciarSincronizacao } from '../syncManager';
import { useSincronizacaoDoApp } from '../useSincronizacaoDoApp';

const iniciarMock = jest.mocked(iniciarSincronizacao);
const pararMock = jest.fn();

let database = criarBancoDeTeste();

function envolver({ children }: { children: ReactNode }) {
  return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  iniciarMock.mockReturnValue(pararMock);
  useSincronizacaoStore.getState().reiniciar();
});

test('liga a sincronização uma única vez, com o banco do provider', async () => {
  const { rerender } = await renderHook(() => useSincronizacaoDoApp(), { wrapper: envolver });
  await rerender({});

  expect(iniciarMock).toHaveBeenCalledTimes(1);
  expect(iniciarMock).toHaveBeenCalledWith(database);
  expect(pararMock).not.toHaveBeenCalled();
});

test('desliga a sincronização ao desmontar', async () => {
  const { unmount } = await renderHook(() => useSincronizacaoDoApp(), { wrapper: envolver });

  await unmount();

  expect(pararMock).toHaveBeenCalledTimes(1);
});

test('enquanto montado, a fila do banco aparece no store de sincronização', async () => {
  await renderHook(() => useSincronizacaoDoApp(), { wrapper: envolver });

  await act(async () => {
    await database.write(() =>
      database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = 'id-1';
        registro.payload = '{}';
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      }),
    );
  });

  await waitFor(() => expect(useSincronizacaoStore.getState().pendentes).toBe(1));
});

test('desmontar zera a contagem publicada', async () => {
  const { unmount } = await renderHook(() => useSincronizacaoDoApp(), { wrapper: envolver });
  useSincronizacaoStore.setState({ pendentes: 5 });

  await unmount();

  expect(useSincronizacaoStore.getState().pendentes).toBe(0);
});
