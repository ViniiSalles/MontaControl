jest.mock('../../sincronizacao/syncManager', () => ({
  puxarBancoHoras: jest.fn().mockResolvedValue(undefined),
}));

import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { upsertBancoHoras } from '../espelhoBancoHoras';
import { useBancoHoras } from '../useBancoHoras';


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

  it('começa com o que já está salvo localmente, mesmo antes de puxar da rede', async () => {
    const database = criarBancoDeTeste();
    await upsertBancoHoras(database, bancoHorasFake());
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result } = await renderHook(() => useBancoHoras(8, 2026), { wrapper });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    // `paraBancoHorasDTO` sempre devolve `id`/`usuarioId` sentinela (-1) — o
    // espelho local não guarda esses dois campos (ver `espelhoBancoHoras.ts`).
    expect(result.current.bancoHoras).toEqual({ ...bancoHorasFake(), id: -1, usuarioId: -1 });
    expect(result.current.erro).toBe(false);
  });

  it('sem dado local nem rede: erro fica true e bancoHoras fica null', async () => {
    const { puxarBancoHoras } = jest.requireMock('../../sincronizacao/syncManager');
    (puxarBancoHoras as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const database = criarBancoDeTeste();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result } = await renderHook(() => useBancoHoras(8, 2026), { wrapper });

    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.bancoHoras).toBeNull();
  });

  it('trocar mes/ano dispara nova leitura do banco local', async () => {
    const { puxarBancoHoras } = jest.requireMock('../../sincronizacao/syncManager');
    (puxarBancoHoras as jest.Mock).mockResolvedValue(undefined);
    const database = criarBancoDeTeste();
    await upsertBancoHoras(database, bancoHorasFake({ mes: 8, ano: 2026 }));
    await upsertBancoHoras(database, bancoHorasFake({ mes: 7, ano: 2026, saldo: -16 }));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result, rerender } = await renderHook(
      ({ mes, ano }: { mes: number; ano: number }) => useBancoHoras(mes, ano),
      { wrapper, initialProps: { mes: 8, ano: 2026 } },
    );

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.bancoHoras?.mes).toBe(8);

    await rerender({ mes: 7, ano: 2026 });

    await waitFor(() =>
      expect(puxarBancoHoras).toHaveBeenLastCalledWith(database, 7, 2026),
    );
    await waitFor(() => expect(result.current.bancoHoras?.mes).toBe(7));
  });
});
