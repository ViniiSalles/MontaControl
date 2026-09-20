jest.mock('../../auth/AuthContext');
jest.mock('../../sincronizacao/syncManager');

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { upsertJornadas } from '../../jornada/espelhoJornada';
import { useAuth } from '../../auth/AuthContext';
import { puxarJornadas } from '../../sincronizacao/syncManager';
import { montador } from '../../auth/__tests__/apoio';
import { Historico } from '../Historico';

const useAuthMock = jest.mocked(useAuth);
const puxarJornadasMock = jest.mocked(puxarJornadas);

const voltar = jest.fn();
const lancarEmAtraso = jest.fn();

let database = criarBancoDeTeste();

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

// Turno padrão do dia 26/08 — 08:00 às 17:00 local (9h). "Agora" é congelado
// em 27/08 (ver `beforeEach`), então cai dentro da janela de qualquer
// período (5/15/30 dias) usada pelos testes.
const TURNO_26_AGO: JornadaDTO = jornada({
  id: 1,
  checkinAt: '2026-08-26T11:00:00.000Z', // 08:00 local
  checkoutAt: '2026-08-26T20:00:00.000Z', // 17:00 local
});

// Segundo turno, dia anterior (24/08), curto (1h) — usado sempre que um
// teste precisa que o total do período (soma dos dias) fique visivelmente
// diferente do total do card de um único dia, evitando dois nós de texto
// iguais ("9h 00min" apareceria tanto no card do dia quanto no total).
const TURNO_24_AGO: JornadaDTO = jornada({
  id: 2,
  checkinAt: '2026-08-24T12:00:00.000Z', // 09:00 local
  checkoutAt: '2026-08-24T13:00:00.000Z', // 10:00 local
});

function renderizar() {
  return render(
    <DatabaseProvider database={database}>
      <Historico aoVoltar={voltar} aoLancarEmAtraso={lancarEmAtraso} />
    </DatabaseProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  // `advanceTimers: true` é obrigatório com `waitFor`: sem isso o polling do
  // Testing Library nunca avança e a suíte trava (CI do PR fica em loop).
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2026-08-27T15:00:00.000Z')); // 12:00 local, dia seguinte
  useAuthMock.mockReturnValue({
    sessao: { accessToken: 'access', refreshToken: 'refresh', usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  puxarJornadasMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('abre em 15 dias e lista os dias do período com o total', async () => {
  await upsertJornadas(database, [TURNO_26_AGO, TURNO_24_AGO]);

  await renderizar();

  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());
  // Período padrão da tela é 15 dias — a busca de rede precisa repassar
  // esse período, senão o espelho local nunca é abastecido além de 5 dias
  // (heartbeat das chamadas em segundo plano) e o total fica incompleto.
  expect(puxarJornadasMock).toHaveBeenCalledWith(database, 'access', 15);
  expect(screen.getByText('9h 00min')).toBeTruthy();
  expect(screen.getByText('08:00')).toBeTruthy();
});

// A LEITURA local reage à troca de período, ampliando a janela
// (`janelaDoPeriodo`) — Turno de 20 dias atrás só entra na conta em 30 dias,
// mesmo que a busca de rede (`puxarJornadas`) também já repasse o período
// novo (ver teste acima e `useHistoricoPontos.ts`).
test('trocar o período amplia a janela lida do espelho local', async () => {
  const TURNO_20_DIAS_ATRAS: JornadaDTO = jornada({
    id: 3,
    checkinAt: '2026-08-07T12:00:00.000Z', // 09:00 local
    checkoutAt: '2026-08-07T13:00:00.000Z', // 10:00 local — turno de 1h
  });
  // TURNO_24_AGO entra desde já (dentro dos 15 dias); TURNO_20_DIAS_ATRAS só
  // entra depois de trocar para 30 dias — os totais (10h, depois 11h) ficam
  // cada um só uma vez na tela, sem colidir com o total de nenhum card de dia.
  await upsertJornadas(database, [TURNO_26_AGO, TURNO_24_AGO, TURNO_20_DIAS_ATRAS]);

  await renderizar();
  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());

  await fireEvent.press(screen.getByText('30 dias'));

  await waitFor(() => expect(screen.getByText('11h 00min')).toBeTruthy());
});

test('período sem pontos mostra estado vazio, não uma lista em branco', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum ponto no período')).toBeTruthy());
});

test('dia sem check-out oferece o atalho de ponto em atraso com a data do card', async () => {
  const semSaida: JornadaDTO = jornada({
    id: 1,
    status: StatusJornada.EM_ANDAMENTO,
    checkinAt: '2026-08-26T11:00:00.000Z',
    checkoutAt: null,
  });
  await upsertJornadas(database, [semSaida]);

  await renderizar();
  await waitFor(() => expect(screen.getByText('Lançar ponto em atraso')).toBeTruthy());

  await fireEvent.press(screen.getByText('Lançar ponto em atraso'));

  expect(lancarEmAtraso).toHaveBeenCalledWith('2026-08-26');
});

test('falha na busca mostra erro e permite tentar de novo', async () => {
  puxarJornadasMock
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(async () => {
      await upsertJornadas(database, [TURNO_26_AGO, TURNO_24_AGO]);
    });

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar o histórico')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Tentar de novo'));

  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());
});

test('voltar devolve o controle para a tela de jornada', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Voltar')).toBeTruthy());

  await fireEvent.press(screen.getByText('Voltar'));

  expect(voltar).toHaveBeenCalled();
});
