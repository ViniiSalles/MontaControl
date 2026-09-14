jest.mock('../../sincronizacao/syncManager', () => ({
  puxarJornadas: jest.fn().mockResolvedValue(undefined),
}));

import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { upsertJornadas } from '../espelhoJornada';
import { useJornadaAtual } from '../useJornadaAtual';

const TOKEN = 'token-de-teste';

function jornadaFalsa(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: 10,
    status: StatusJornada.EM_ANDAMENTO,
    checkinAt: '2026-08-29T12:00:00.000Z',
    checkinLatitude: -19.9325,
    checkinLongitude: -43.9382,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-29T12:00:00.000Z',
    ...parcial,
  };
}

describe('useJornadaAtual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('começa com o que já está salvo localmente, mesmo antes de puxar da rede', async () => {
    const database = criarBancoDeTeste();
    await upsertJornadas(database, [jornadaFalsa({ checkinEndereco: 'Rua Falsa, 123' })]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result } = await renderHook(() => useJornadaAtual(TOKEN), { wrapper });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.jornada?.checkinEndereco).toBe('Rua Falsa, 123');
    expect(result.current.erro).toBe(false);
  });

  it('sem dado local nem rede: erro fica true', async () => {
    const { puxarJornadas } = jest.requireMock('../../sincronizacao/syncManager');
    (puxarJornadas as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const database = criarBancoDeTeste();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result } = await renderHook(() => useJornadaAtual(TOKEN), { wrapper });

    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.jornada).toBeNull();
  });
});
