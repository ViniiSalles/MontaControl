jest.mock('../../sincronizacao/syncManager');
jest.mock('../../banco-horas/clienteBancoHoras');

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import type { BancoHorasDTO, SyncBancoHorasRow } from '@montacontrol/shared';
import { criarBancoDeTeste, gravarLinhasNaReplica } from '../../db/__tests__/apoio';
import { buscarBancoHoras } from '../../banco-horas/clienteBancoHoras';
import { sincronizar } from '../../sincronizacao/syncManager';
import { montador } from '../../auth/__tests__/apoio';
import { BancoHoras } from '../BancoHoras';

const sincronizarMock = jest.mocked(sincronizar);
const buscarBancoHorasMock = jest.mocked(buscarBancoHoras);

const voltar = jest.fn();

let database = criarBancoDeTeste();

function linhaDeAgosto(parcial: Partial<SyncBancoHorasRow> = {}): SyncBancoHorasRow {
  return {
    id: '1',
    mes: 8,
    ano: 2026,
    horas_trabalhadas: 160,
    horas_previstas: 168,
    saldo: -8,
    ...parcial,
  };
}

function bancoHorasDoServidor(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return {
    id: 2,
    usuarioId: montador.id,
    mes: 7,
    ano: 2026,
    horasTrabalhadas: 100,
    horasPrevistas: 176,
    saldo: -76,
    ...parcial,
  };
}

function renderizar() {
  return render(
    <DatabaseProvider database={database}>
      <BancoHoras aoVoltar={voltar} />
    </DatabaseProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  // `advanceTimers: true` é obrigatório com `waitFor`: sem isso o polling do
  // Testing Library nunca avança e a suíte trava (CI do PR fica em loop).
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2026-08-26T17:00:00.000Z')); // 14:00 local
  sincronizarMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('abre no mês corrente e mostra o saldo da réplica, sem ir à rede', async () => {
  await gravarLinhasNaReplica(database, 'banco_horas', [linhaDeAgosto()]);

  await renderizar();

  await waitFor(() => expect(screen.getByText('-8h 00min')).toBeTruthy());
  expect(screen.getByText('Agosto de 2026')).toBeTruthy();
  expect(screen.getByText('160h 00min')).toBeTruthy();
  expect(screen.getByText('168h 00min')).toBeTruthy();
  expect(buscarBancoHorasMock).not.toHaveBeenCalled();
});

test('botão "próximo mês" não avança quando já está no mês corrente', async () => {
  await gravarLinhasNaReplica(database, 'banco_horas', [linhaDeAgosto()]);
  await renderizar();
  await waitFor(() => expect(screen.getByText('Agosto de 2026')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Próximo mês'));

  // `desabilitado` no `Botao` impede o `onPress` (mesmo padrão de
  // `ui/__tests__/Botao.test.tsx`, "desabilitado não dispara aoPressionar") —
  // o mês exibido continua o mesmo.
  expect(screen.getByText('Agosto de 2026')).toBeTruthy();
});

test('mês anterior fora da réplica é consultado online e mostrado; voltar ao corrente lê a réplica', async () => {
  await gravarLinhasNaReplica(database, 'banco_horas', [linhaDeAgosto()]);
  buscarBancoHorasMock.mockResolvedValue(bancoHorasDoServidor());
  await renderizar();
  await waitFor(() => expect(screen.getByText('Agosto de 2026')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Mês anterior'));

  await waitFor(() => expect(screen.getByText('-76h 00min')).toBeTruthy());
  expect(screen.getByText('Julho de 2026')).toBeTruthy();
  expect(buscarBancoHorasMock).toHaveBeenCalledWith(7, 2026);
  // A consulta online é só de exibição: a réplica não ganha a linha.
  expect(await database.get('banco_horas').query().fetchCount()).toBe(1);

  await fireEvent.press(screen.getByLabelText('Próximo mês'));

  await waitFor(() => expect(screen.getByText('-8h 00min')).toBeTruthy());
  expect(screen.getByText('Agosto de 2026')).toBeTruthy();
});

test('mês fora da réplica e sem rede: avisa que não há dados offline e permite tentar de novo', async () => {
  buscarBancoHorasMock.mockRejectedValueOnce(new Error('offline'));
  await renderizar();
  await waitFor(() => expect(screen.getByText('Sem dados offline para este mês')).toBeTruthy());

  buscarBancoHorasMock.mockResolvedValueOnce(bancoHorasDoServidor({ mes: 8, saldo: -8 }));
  await fireEvent.press(screen.getByText('Tentar de novo'));

  await waitFor(() => expect(screen.getByText('-8h 00min')).toBeTruthy());
  expect(sincronizarMock).toHaveBeenCalled();
});

test('voltar devolve o controle para a tela de jornada', async () => {
  await gravarLinhasNaReplica(database, 'banco_horas', [linhaDeAgosto()]);
  await renderizar();
  await waitFor(() => expect(screen.getByText('Voltar')).toBeTruthy());

  await fireEvent.press(screen.getByText('Voltar'));

  expect(voltar).toHaveBeenCalled();
});
