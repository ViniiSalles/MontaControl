jest.mock('../clienteAtestados', () => ({ listarMeusAtestados: jest.fn() }));

import { renderHook, waitFor } from '@testing-library/react-native';
import type { AtestadoDTO } from '@montacontrol/shared';
import { StatusAtestado } from '@montacontrol/shared';
import { listarMeusAtestados } from '../clienteAtestados';
import { useMeusAtestados } from '../useMeusAtestados';

const listarMock = jest.mocked(listarMeusAtestados);

const ATESTADO: AtestadoDTO = {
  id: 1,
  usuarioId: 10,
  usuarioNome: 'Vinicius Salles',
  dataInicio: '2026-09-01',
  dataFim: '2026-09-03',
  status: StatusAtestado.PENDENTE,
  motivoRejeicao: null,
  validadoPor: null,
  validadoEm: null,
  criadoEm: '2026-09-01T12:00:00.000Z',
};

describe('useMeusAtestados', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('carrega os atestados do montador ao montar', async () => {
    listarMock.mockResolvedValue([ATESTADO]);

    const { result } = await renderHook(() => useMeusAtestados('token-abc'));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.atestados).toEqual([ATESTADO]);
    expect(result.current.erro).toBe(false);
    expect(listarMock).toHaveBeenCalledWith('token-abc');
  });

  it('falha na busca marca erro e mantém a lista vazia', async () => {
    listarMock.mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useMeusAtestados('token-abc'));

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toBe(true);
    expect(result.current.atestados).toEqual([]);
  });

  it('recarregar refaz a busca', async () => {
    listarMock.mockResolvedValueOnce([]).mockResolvedValueOnce([ATESTADO]);

    const { result } = await renderHook(() => useMeusAtestados('token-abc'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await result.current.recarregar();

    await waitFor(() => expect(result.current.atestados).toEqual([ATESTADO]));
    expect(listarMock).toHaveBeenCalledTimes(2);
  });
});
