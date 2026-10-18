jest.mock('../syncManager');

import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { AcaoPendente } from '../../db/AcaoPendente';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { ProvedorSincronizacao, useSincronizacao } from '../SincronizacaoContext';
import { iniciarSincronizacao } from '../syncManager';

const iniciarMock = jest.mocked(iniciarSincronizacao);
const pararMock = jest.fn();

let database = criarBancoDeTeste();

function envolver({ children }: { children: ReactNode }) {
  return (
    <DatabaseProvider database={database}>
      <ProvedorSincronizacao>{children}</ProvedorSincronizacao>
    </DatabaseProvider>
  );
}

function criarAcao(status: 'pendente' | 'descartada', mensagemDescarte: string | null = null) {
  return database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'avaria';
      registro.idCliente = `id-${Math.random()}`;
      registro.payload = '{}';
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = status;
      registro.mensagemDescarte = mensagemDescarte;
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  iniciarMock.mockReturnValue(pararMock);
});

test('liga a sincronização uma única vez, com o banco do provider', async () => {
  const { rerender } = await renderHook(() => useSincronizacao(), { wrapper: envolver });
  await rerender({});

  expect(iniciarMock).toHaveBeenCalledTimes(1);
  expect(iniciarMock).toHaveBeenCalledWith(database);
  expect(pararMock).not.toHaveBeenCalled();
});

test('desliga a sincronização ao desmontar', async () => {
  const { unmount } = await renderHook(() => useSincronizacao(), { wrapper: envolver });

  await unmount();

  expect(pararMock).toHaveBeenCalledTimes(1);
});

test('expõe a contagem de ações pendentes e acompanha a fila', async () => {
  const { result } = await renderHook(() => useSincronizacao(), { wrapper: envolver });
  await waitFor(() => expect(result.current.pendentes).toBe(0));

  await act(async () => {
    await criarAcao('pendente');
    await criarAcao('pendente');
  });
  await waitFor(() => expect(result.current.pendentes).toBe(2));

  await act(async () => {
    const [primeira] = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    await database.write(() => primeira.destroyPermanently());
  });
  await waitFor(() => expect(result.current.pendentes).toBe(1));
});

test('ação descartada vira aviso e sai da fila', async () => {
  const { result } = await renderHook(() => useSincronizacao(), { wrapper: envolver });
  expect(result.current.avisosDescartados).toEqual([]);

  await act(async () => {
    await criarAcao('descartada', 'Ação recusada: JORNADA_EM_ANDAMENTO.');
  });

  await waitFor(() =>
    expect(result.current.avisosDescartados).toEqual(['Ação recusada: JORNADA_EM_ANDAMENTO.']),
  );
  await waitFor(async () =>
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(0),
  );
});

test('dispensarAvisos limpa os avisos já mostrados', async () => {
  const { result } = await renderHook(() => useSincronizacao(), { wrapper: envolver });
  await act(async () => {
    await criarAcao('descartada', 'Ação recusada: X.');
  });
  await waitFor(() => expect(result.current.avisosDescartados).toHaveLength(1));

  await act(async () => result.current.dispensarAvisos());

  expect(result.current.avisosDescartados).toEqual([]);
});

test('useSincronizacao fora do provider falha alto', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);

  await expect(renderHook(() => useSincronizacao())).rejects.toThrow(/ProvedorSincronizacao/);
});
