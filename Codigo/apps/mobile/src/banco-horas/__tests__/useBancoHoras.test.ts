jest.mock('../clienteBancoHoras');

import { renderHook, waitFor } from '@testing-library/react-native';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { buscarBancoHoras } from '../clienteBancoHoras';
import { useBancoHoras } from '../useBancoHoras';

const TOKEN = 'token-de-teste';

function bancoHorasFake(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return {
    id: 1,
    usuarioId: 7,
    mes: 8,
    ano: 2026,
    horasTrabalhadas: 160,
    horasPrevistas: 168,
    saldo: -8,
    ...parcial,
  };
}

describe('useBancoHoras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('começa carregando e preenche o saldo', async () => {
    let resolverBusca!: (dados: BancoHorasDTO) => void;
    (buscarBancoHoras as jest.Mock).mockReturnValue(
      new Promise<BancoHorasDTO>((resolve) => {
        resolverBusca = resolve;
      }),
    );

    const { result } = await renderHook(() => useBancoHoras(TOKEN, 8, 2026));

    expect(result.current.carregando).toBe(true);

    resolverBusca(bancoHorasFake());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.bancoHoras).toEqual(bancoHorasFake());
    expect(result.current.erro).toBe(false);
  });

  it('falha da API deixa erro true e bancoHoras null', async () => {
    (buscarBancoHoras as jest.Mock).mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useBancoHoras(TOKEN, 8, 2026));

    await waitFor(() => expect(result.current.carregando).toBe(false));

    expect(result.current.erro).toBe(true);
    expect(result.current.bancoHoras).toBeNull();
  });

  it('trocar mes/ano dispara nova busca', async () => {
    (buscarBancoHoras as jest.Mock).mockResolvedValue(bancoHorasFake({ mes: 8 }));

    const { result, rerender } = await renderHook(
      ({ mes, ano }: { mes: number; ano: number }) => useBancoHoras(TOKEN, mes, ano),
      { initialProps: { mes: 8, ano: 2026 } },
    );

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(buscarBancoHoras).toHaveBeenLastCalledWith(TOKEN, 8, 2026);

    (buscarBancoHoras as jest.Mock).mockResolvedValue(bancoHorasFake({ mes: 7 }));
    await rerender({ mes: 7, ano: 2026 });

    await waitFor(() => expect(buscarBancoHoras).toHaveBeenLastCalledWith(TOKEN, 7, 2026));
  });
});
