jest.mock('../../sincronizacao/syncManager', () => ({
  puxarJornadas: jest.fn().mockResolvedValue(undefined),
}));

import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { upsertJornadas } from '../espelhoJornada';
import { useHistoricoPontos } from '../useHistoricoPontos';

const TOKEN = 'token-de-teste';

// Turno de 8h encerrado há poucas horas — precisa cair dentro da janela de
// `janelaDoPeriodo` calculada a partir de "agora" (a leitura reativa filtra
// pelo relógio real, não por um mock de rede), então a fixture não pode usar
// uma data fixa no passado como as suítes antigas faziam.
const CHECKOUT_HA_1H = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const CHECKIN_HA_9H = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();

function jornadaFalsa(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: 10,
    status: StatusJornada.FINALIZADA,
    checkinAt: CHECKIN_HA_9H,
    checkinLatitude: -19.9325,
    checkinLongitude: -43.9382,
    checkinEndereco: null,
    checkoutAt: CHECKOUT_HA_1H,
    checkoutLatitude: -19.9325,
    checkoutLongitude: -43.9382,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: CHECKIN_HA_9H,
    ...parcial,
  };
}

describe('useHistoricoPontos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('começa com o que já está salvo localmente, mesmo antes de puxar da rede', async () => {
    const database = criarBancoDeTeste();
    await upsertJornadas(database, [jornadaFalsa()]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result } = await renderHook(() => useHistoricoPontos(TOKEN, 5), { wrapper });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.totalMinutos).toBe(480);
    expect(result.current.dias).toHaveLength(1);
    expect(result.current.erro).toBe(false);
  });

  it('sem dado local nem rede: erro fica true e dias fica vazio', async () => {
    const { puxarJornadas } = jest.requireMock('../../sincronizacao/syncManager');
    (puxarJornadas as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    const database = criarBancoDeTeste();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result } = await renderHook(() => useHistoricoPontos(TOKEN, 15), { wrapper });

    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.dias).toEqual([]);
  });

  it('trocar o período dispara nova leitura do banco local com a janela nova', async () => {
    const { puxarJornadas } = jest.requireMock('../../sincronizacao/syncManager');
    (puxarJornadas as jest.Mock).mockResolvedValue(undefined);
    const database = criarBancoDeTeste();
    await upsertJornadas(database, [jornadaFalsa()]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    const { result, rerender } = await renderHook(
      ({ periodo }: { periodo: 5 | 15 | 30 }) => useHistoricoPontos(TOKEN, periodo),
      { wrapper, initialProps: { periodo: 5 } },
    );

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.totalMinutos).toBe(480);

    await rerender({ periodo: 30 });

    await waitFor(() => expect(puxarJornadas).toHaveBeenLastCalledWith(database, TOKEN, 30));
    await waitFor(() => expect(result.current.totalMinutos).toBe(480));
  });

  it('recarregar repassa o período pedido pra rede — não fica preso em 5 dias fixos', async () => {
    const { puxarJornadas } = jest.requireMock('../../sincronizacao/syncManager');
    (puxarJornadas as jest.Mock).mockResolvedValue(undefined);
    const database = criarBancoDeTeste();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    );

    await renderHook(() => useHistoricoPontos(TOKEN, 15), { wrapper });

    await waitFor(() => expect(puxarJornadas).toHaveBeenCalledWith(database, TOKEN, 15));
  });
});
