jest.mock('../../sincronizacao/syncManager');

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { StatusJornada } from '@montacontrol/shared';
import type { SyncJornadaRow } from '@montacontrol/shared';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  linhaDeJornada,
} from '../../db/__tests__/apoio';
import {
  atualizarStatusDaSincronizacao,
  reiniciarStatusDaSincronizacao,
} from '../../sincronizacao/statusDaSincronizacao';
import { sincronizar } from '../../sincronizacao/syncManager';
import { Historico } from '../Historico';

const sincronizarMock = jest.mocked(sincronizar);

const voltar = jest.fn();
const lancarEmAtraso = jest.fn();

let database = criarBancoDeTeste();

// Turno padrão do dia 26/08 — 08:00 às 17:00 local (9h). "Agora" é congelado
// em 27/08 (ver `beforeEach`), então cai dentro da janela de qualquer
// período (5/15/30 dias) usada pelos testes.
const TURNO_26_AGO: SyncJornadaRow = linhaDeJornada({
  checkin_at: '2026-08-26T11:00:00.000Z', // 08:00 local
  checkout_at: '2026-08-26T20:00:00.000Z', // 17:00 local
});

// Segundo turno, dia anterior (24/08), curto (1h) — usado sempre que um
// teste precisa que o total do período (soma dos dias) fique visivelmente
// diferente do total do card de um único dia, evitando dois nós de texto
// iguais ("9h 00min" apareceria tanto no card do dia quanto no total).
const TURNO_24_AGO: SyncJornadaRow = linhaDeJornada({
  checkin_at: '2026-08-24T12:00:00.000Z', // 09:00 local
  checkout_at: '2026-08-24T13:00:00.000Z', // 10:00 local
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
  reiniciarStatusDaSincronizacao();
  // `advanceTimers: true` é obrigatório com `waitFor`: sem isso o polling do
  // Testing Library nunca avança e a suíte trava (CI do PR fica em loop).
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2026-08-27T15:00:00.000Z')); // 12:00 local, dia seguinte
  sincronizarMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('abre em 15 dias e lista os dias do período com o total, lendo só a réplica', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [TURNO_26_AGO, TURNO_24_AGO]);

  await renderizar();

  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());
  expect(screen.getByText('9h 00min')).toBeTruthy();
  expect(screen.getByText('08:00')).toBeTruthy();
  // Quem sincroniza é o provider do app, não a tela.
  expect(sincronizarMock).not.toHaveBeenCalled();
});

// A leitura reage à troca de período, ampliando a janela (`janelaDoPeriodo`):
// turno de 20 dias atrás só entra na conta em 30 dias, sem nova ida à rede.
test('trocar o período amplia a janela lida da réplica', async () => {
  const TURNO_20_DIAS_ATRAS = linhaDeJornada({
    checkin_at: '2026-08-07T12:00:00.000Z', // 09:00 local
    checkout_at: '2026-08-07T13:00:00.000Z', // 10:00 local — turno de 1h
  });
  // TURNO_24_AGO entra desde já (dentro dos 15 dias); TURNO_20_DIAS_ATRAS só
  // entra depois de trocar para 30 dias — os totais (10h, depois 11h) ficam
  // cada um só uma vez na tela, sem colidir com o total de nenhum card de dia.
  await gravarLinhasNaReplica(database, 'jornadas', [TURNO_26_AGO, TURNO_24_AGO, TURNO_20_DIAS_ATRAS]);

  await renderizar();
  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());

  await fireEvent.press(screen.getByText('30 dias'));

  await waitFor(() => expect(screen.getByText('11h 00min')).toBeTruthy());
  expect(sincronizarMock).not.toHaveBeenCalled();
});

test('período sem pontos mostra estado vazio, não uma lista em branco', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum ponto no período')).toBeTruthy());
});

test('dia sem check-out oferece o atalho de ponto em atraso com a data do card', async () => {
  const semSaida = linhaDeJornada({
    status: StatusJornada.EM_ANDAMENTO,
    checkin_at: '2026-08-26T11:00:00.000Z',
    checkout_at: null,
    checkout_latitude: null,
    checkout_longitude: null,
    checkout_endereco: null,
    checkout_id_cliente: null,
  });
  await gravarLinhasNaReplica(database, 'jornadas', [semSaida]);

  await renderizar();
  await waitFor(() => expect(screen.getByText('Lançar ponto em atraso')).toBeTruthy());

  await fireEvent.press(screen.getByText('Lançar ponto em atraso'));

  expect(lancarEmAtraso).toHaveBeenCalledWith('2026-08-26');
});

test('ponto marcado offline (ainda na fila) já aparece no histórico', async () => {
  await criarAcaoPendente(database, {
    tipo: 'checkin',
    idCliente: 'checkin-offline',
    payload: {
      idCliente: 'checkin-offline',
      latitude: -19.9,
      longitude: -43.9,
      registradoEm: '2026-08-27T11:00:00.000Z', // 08:00 local de hoje
      pedidoId: 12,
    },
  });

  await renderizar();

  // Dia de hoje, sem check-out: entra com o atalho do ponto em atraso.
  await waitFor(() => expect(screen.getByText('Lançar ponto em atraso')).toBeTruthy());
  expect(screen.getByText('08:00')).toBeTruthy();
});

test('sem dado local e com a sincronização falhando, mostra erro e permite tentar de novo', async () => {
  atualizarStatusDaSincronizacao({ ultimoErro: 'sem_rede' });

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar o histórico')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Tentar de novo'));

  expect(sincronizarMock).toHaveBeenCalledTimes(1);

  // O pull que o gatilho dispara grava a réplica e limpa o erro.
  await act(async () => {
    await gravarLinhasNaReplica(database, 'jornadas', [TURNO_26_AGO, TURNO_24_AGO]);
    atualizarStatusDaSincronizacao({ ultimoErro: null });
  });

  await waitFor(() => expect(screen.getByText('10h 00min')).toBeTruthy());
});

test('voltar devolve o controle para a tela de jornada', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Voltar')).toBeTruthy());

  await fireEvent.press(screen.getByText('Voltar'));

  expect(voltar).toHaveBeenCalled();
});
