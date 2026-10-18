import { act, renderHook, waitFor } from '@testing-library/react-native';
import { syncPullFixture } from '@montacontrol/shared';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste, gravarLinhasNaReplica, gravarPullNaReplica } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { reiniciarStatusDaSincronizacao } from '../../sincronizacao/statusDaSincronizacao';
import { useBancoHoras } from '../useBancoHoras';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

/** Mês da réplica do fixture (set/2026, id '32'). */
const MES_NA_REPLICA = syncPullFixture.changes.banco_horas.updated[1];

function bancoHorasDoServidor(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return {
    id: 900,
    usuarioId: 7,
    mes: 3,
    ano: 2026,
    horasTrabalhadas: 150,
    horasPrevistas: 168,
    saldo: -18,
    ...parcial,
  };
}

function semResposta() {
  const liberar: Array<(dto: BancoHorasDTO) => void> = [];
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolver) => {
        liberar.push((dto) => resolver(respostaJson(200, dto)));
      }),
  );
  return liberar;
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  reiniciarStatusDaSincronizacao();
});

describe('useBancoHoras', () => {
  it('mês que está na réplica: lê do banco local, sem ir à rede', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const { result } = await renderHook(() => useBancoHoras(MES_NA_REPLICA.mes, MES_NA_REPLICA.ano), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.bancoHoras).toMatchObject({
      mes: MES_NA_REPLICA.mes,
      ano: MES_NA_REPLICA.ano,
      horasTrabalhadas: MES_NA_REPLICA.horas_trabalhadas,
      horasPrevistas: MES_NA_REPLICA.horas_previstas,
      saldo: MES_NA_REPLICA.saldo,
    });
    expect(result.current.semDadosOffline).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mês fora da réplica e online: busca no servidor só para exibir e NÃO grava na réplica', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);
    const linhasAntes = await database.get('banco_horas').query().fetchCount();
    fetchMock.mockResolvedValue(respostaJson(200, bancoHorasDoServidor({ mes: 3, ano: 2026 })));

    const { result } = await renderHook(() => useBancoHoras(3, 2026), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.bancoHoras).not.toBeNull());
    expect(result.current.bancoHoras).toMatchObject({ mes: 3, ano: 2026, saldo: -18 });
    expect(result.current.carregando).toBe(false);
    expect(result.current.semDadosOffline).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/banco-horas?mes=3&ano=2026');
    expect(await database.get('banco_horas').query().fetchCount()).toBe(linhasAntes);
  });

  it('mês fora da réplica e offline: "sem dados offline", sem erro de tela nem valor inventado', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const { result } = await renderHook(() => useBancoHoras(3, 2026), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(result.current.semDadosOffline).toBe(true));
    expect(result.current.bancoHoras).toBeNull();
    expect(result.current.carregando).toBe(false);
  });

  it('enquanto a consulta ao servidor não volta, continua carregando', async () => {
    const database = criarBancoDeTeste();
    semResposta();

    const { result } = await renderHook(() => useBancoHoras(3, 2026), {
      wrapper: comBanco(database),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.carregando).toBe(true);
    expect(result.current.semDadosOffline).toBe(false);
  });

  it('trocar mes/ano lê a linha do outro mês da réplica', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);
    const [agosto, setembro] = syncPullFixture.changes.banco_horas.updated;

    const { result, rerender } = await renderHook(
      ({ mes, ano }: { mes: number; ano: number }) => useBancoHoras(mes, ano),
      { wrapper: comBanco(database), initialProps: { mes: setembro.mes, ano: setembro.ano } },
    );
    await waitFor(() => expect(result.current.bancoHoras?.mes).toBe(setembro.mes));

    await rerender({ mes: agosto.mes, ano: agosto.ano });

    await waitFor(() => expect(result.current.bancoHoras?.mes).toBe(agosto.mes));
    expect(result.current.bancoHoras?.saldo).toBe(agosto.saldo);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resposta atrasada de um mês que já não está na tela é descartada', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'banco_horas', [
      { id: '1', mes: 8, ano: 2026, horas_trabalhadas: 160, horas_previstas: 168, saldo: -8 },
    ]);
    const liberar = semResposta();

    const { result, rerender } = await renderHook(
      ({ mes, ano }: { mes: number; ano: number }) => useBancoHoras(mes, ano),
      { wrapper: comBanco(database), initialProps: { mes: 3, ano: 2026 } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await rerender({ mes: 8, ano: 2026 });
    await waitFor(() => expect(result.current.bancoHoras?.mes).toBe(8));
    await act(async () => {
      liberar[0](bancoHorasDoServidor({ mes: 3, ano: 2026 }));
    });

    expect(result.current.bancoHoras?.mes).toBe(8);
  });

  it('recarregar sincroniza e tenta de novo a consulta do mês ausente', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const { result } = await renderHook(() => useBancoHoras(3, 2026), {
      wrapper: comBanco(database),
    });
    await waitFor(() => expect(result.current.semDadosOffline).toBe(true));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/banco-horas')
        ? respostaJson(200, bancoHorasDoServidor({ mes: 3, ano: 2026 }))
        : respostaJson(503, { codigo: 'INDISPONIVEL', message: 'fora do ar' }),
    );

    await act(async () => {
      await result.current.recarregar();
    });

    await waitFor(() => expect(result.current.bancoHoras?.mes).toBe(3));
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes('/api/sync/pull'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/banco-horas?mes=3&ano=2026'))).toBe(true);
  });
});
