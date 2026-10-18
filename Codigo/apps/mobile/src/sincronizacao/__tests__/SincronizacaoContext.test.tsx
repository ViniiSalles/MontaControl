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

/**
 * Intercepta só o `batch` que apaga ações (o do provider); criar linhas segue
 * usando o `batch` real. `resultado` decide o que o apagamento devolve.
 */
function interceptarApagamento(resultado: () => Promise<void>) {
  const original = database.batch.bind(database) as (...args: unknown[]) => Promise<void>;
  jest
    .spyOn(database, 'batch')
    .mockImplementation(((...args: unknown[]) =>
      args.some(
        (registro) =>
          (registro as { _preparedState?: string })?._preparedState === 'destroyPermanently',
      )
        ? resultado()
        : original(...args)) as never);
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

test('recusas em momentos diferentes se acumulam, sem perder a anterior', async () => {
  const { result } = await renderHook(() => useSincronizacao(), { wrapper: envolver });

  await act(async () => {
    await criarAcao('descartada', 'Avaria recusada: A.');
  });
  await waitFor(() => expect(result.current.avisosDescartados).toEqual(['Avaria recusada: A.']));

  await act(async () => {
    await criarAcao('descartada', 'Check-out recusado: B.');
  });
  await waitFor(() =>
    expect(result.current.avisosDescartados).toEqual([
      'Avaria recusada: A.',
      'Check-out recusado: B.',
    ]),
  );
});

test('o mesmo registro reemitido pelo observe não duplica o aviso', async () => {
  // Sem o destroy a linha A continua na tabela e volta a ser emitida junto com B.
  interceptarApagamento(() => Promise.resolve());
  const { result } = await renderHook(() => useSincronizacao(), { wrapper: envolver });

  await act(async () => {
    await criarAcao('descartada', 'Avaria recusada: A.');
  });
  await waitFor(() => expect(result.current.avisosDescartados).toHaveLength(1));
  await act(async () => {
    await criarAcao('descartada', 'Check-out recusado: B.');
  });

  await waitFor(() => expect(result.current.avisosDescartados).toHaveLength(2));
  expect(result.current.avisosDescartados).toEqual([
    'Avaria recusada: A.',
    'Check-out recusado: B.',
  ]);
});

test('falha ao apagar a ação descartada não vira rejeição não tratada', async () => {
  interceptarApagamento(() => Promise.reject(new Error('falha de disco')));
  const naoTratada = jest.fn();
  process.on('unhandledRejection', naoTratada);
  const { result } = await renderHook(() => useSincronizacao(), { wrapper: envolver });

  await act(async () => {
    await criarAcao('descartada', 'Ação recusada: X.');
  });
  await waitFor(() => expect(result.current.avisosDescartados).toHaveLength(1));
  await new Promise<void>((resolver) => setTimeout(resolver, 20));

  process.off('unhandledRejection', naoTratada);
  expect(naoTratada).not.toHaveBeenCalled();
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

test('ao apagar a ação descartada apaga também as fotos dela que ainda estejam no aparelho', async () => {
  const origem = new File(Paths.cache, 'picker-descartada.jpg');
  origem.create({ intermediates: true, overwrite: true });
  origem.write('foto');
  const caminho = await salvarFoto(origem.uri, 'image/jpeg');
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'atestado';
      registro.idCliente = 'atestado-descartado';
      registro.payload = JSON.stringify({ fotosCaminhos: [caminho] });
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'descartada';
      registro.mensagemDescarte = 'Ação recusada: X.';
    }),
  );

  await renderHook(() => useSincronizacao(), { wrapper: envolver });

  await waitFor(() => expect(new File(caminho).exists).toBe(false));
  await apagarTodasAsFotos();
});
