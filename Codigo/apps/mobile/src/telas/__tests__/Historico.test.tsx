jest.mock('../../auth/AuthContext');
jest.mock('../../jornada/clienteJornadas');

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO, HistoricoJornadasDTO, JornadaDTO } from '@montacontrol/shared';
import { useAuth } from '../../auth/AuthContext';
import { buscarHistorico } from '../../jornada/clienteJornadas';
import { montador } from '../../auth/__tests__/apoio';
import { Historico } from '../Historico';

const useAuthMock = jest.mocked(useAuth);
const buscarHistoricoMock = jest.mocked(buscarHistorico);

const voltar = jest.fn();
const lancarEmAtraso = jest.fn();

function jornada(parcial: Partial<JornadaDTO> & { id: number }): JornadaDTO {
  return {
    usuarioId: montador.id,
    status: StatusJornada.FINALIZADA,
    checkinAt: null,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-26T11:00:00.000Z',
    ...parcial,
  };
}

// `jornadas` precisa vir preenchido: o card do dia lista turno a turno, não
// mais o resumo min/max do dia.
function dia(parcial: Partial<DiaJornadaDTO> = {}): DiaJornadaDTO {
  return {
    data: '2026-08-26',
    inicio: '2026-08-26T11:00:00.000Z', // 08:00 local
    fim: '2026-08-26T20:00:00.000Z', // 17:00 local
    minutosTrabalhados: 540,
    emAndamento: false,
    jornadas: [
      jornada({
        id: 1,
        checkinAt: '2026-08-26T11:00:00.000Z',
        checkoutAt: '2026-08-26T20:00:00.000Z',
      }),
    ],
    ...parcial,
  };
}

// Total do período diferente do total do dia de propósito: os dois usam
// `formatarDuracao`, e valores iguais dariam dois nós com o mesmo texto.
function historico(dias: DiaJornadaDTO[], totalMinutos = 600): HistoricoJornadasDTO {
  return {
    periodoDias: 15,
    inicioPeriodo: '2026-08-15',
    fimPeriodo: '2026-08-29',
    dias,
    totalMinutos,
  };
}

function renderizar() {
  return render(<Historico aoVoltar={voltar} aoLancarEmAtraso={lancarEmAtraso} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({
    sessao: { accessToken: 'access', refreshToken: 'refresh', usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  buscarHistoricoMock.mockResolvedValue(historico([dia()]));
});

test('abre em 15 dias e lista os dias do período com o total', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());
  expect(buscarHistoricoMock).toHaveBeenCalledWith('access', 15);
  expect(screen.getByText('9h 00min')).toBeTruthy();
  expect(screen.getByText('08:00')).toBeTruthy();
});

test('trocar o período refaz a busca com o novo recorte', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('30 dias')).toBeTruthy());

  await fireEvent.press(screen.getByText('30 dias'));

  await waitFor(() => expect(buscarHistoricoMock).toHaveBeenCalledWith('access', 30));
});

test('período sem pontos mostra estado vazio, não uma lista em branco', async () => {
  buscarHistoricoMock.mockResolvedValue(historico([], 0));

  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum ponto no período')).toBeTruthy());
});

test('dia sem check-out oferece o atalho de ponto em atraso com a data do card', async () => {
  const semSaida = dia({
    fim: null,
    emAndamento: true,
    minutosTrabalhados: 0,
    jornadas: [
      jornada({ id: 1, status: StatusJornada.EM_ANDAMENTO, checkinAt: '2026-08-26T11:00:00.000Z' }),
    ],
  });
  buscarHistoricoMock.mockResolvedValue(historico([semSaida], 0));

  await renderizar();
  await waitFor(() => expect(screen.getByText('Lançar ponto em atraso')).toBeTruthy());

  await fireEvent.press(screen.getByText('Lançar ponto em atraso'));

  expect(lancarEmAtraso).toHaveBeenCalledWith('2026-08-26');
});

test('falha na busca mostra erro e permite tentar de novo', async () => {
  buscarHistoricoMock.mockRejectedValueOnce(new Error('offline'));

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar o histórico')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Tentar de novo'));

  await waitFor(() => expect(screen.getByText('9h 00min')).toBeTruthy());
});

test('voltar devolve o controle para a tela de jornada', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Voltar')).toBeTruthy());

  await fireEvent.press(screen.getByText('Voltar'));

  expect(voltar).toHaveBeenCalled();
});
