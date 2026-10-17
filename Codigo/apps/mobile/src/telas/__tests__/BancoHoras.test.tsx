jest.mock('../../sincronizacao/syncManager');

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { upsertBancoHoras } from '../../banco-horas/espelhoBancoHoras';
import { puxarBancoHoras } from '../../sincronizacao/syncManager';
import { montador } from '../../auth/__tests__/apoio';
import { BancoHoras } from '../BancoHoras';

const puxarBancoHorasMock = jest.mocked(puxarBancoHoras);

const voltar = jest.fn();

let database = criarBancoDeTeste();

function bancoHorasFake(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return {
    id: 1,
    usuarioId: montador.id,
    mes: 8,
    ano: 2026,
    horasTrabalhadas: 160,
    horasPrevistas: 168,
    saldo: -8,
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
  puxarBancoHorasMock.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('abre no mês corrente e mostra o saldo', async () => {
  await upsertBancoHoras(database, bancoHorasFake());

  await renderizar();

  await waitFor(() => expect(screen.getByText('-8h 00min')).toBeTruthy());
  expect(puxarBancoHorasMock).toHaveBeenCalledWith(database, 8, 2026);
  expect(screen.getByText('Agosto de 2026')).toBeTruthy();
  expect(screen.getByText('160h 00min')).toBeTruthy();
  expect(screen.getByText('168h 00min')).toBeTruthy();
});

test('botão "próximo mês" não avança quando já está no mês corrente', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Agosto de 2026')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Próximo mês'));

  // `desabilitado` no `Botao` impede o `onPress` (mesmo padrão de
  // `ui/__tests__/Botao.test.tsx`, "desabilitado não dispara aoPressionar") —
  // nenhuma busca nova, mês exibido continua o mesmo.
  expect(puxarBancoHorasMock).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Agosto de 2026')).toBeTruthy();
});

test('mês anterior refaz a busca e volta a permitir avançar', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Agosto de 2026')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Mês anterior'));

  await waitFor(() =>
    expect(puxarBancoHorasMock).toHaveBeenLastCalledWith(database, 7, 2026),
  );
  await waitFor(() => expect(screen.getByText('Julho de 2026')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Próximo mês'));

  await waitFor(() =>
    expect(puxarBancoHorasMock).toHaveBeenLastCalledWith(database, 8, 2026),
  );
  await waitFor(() => expect(screen.getByText('Agosto de 2026')).toBeTruthy());
});

test('falha na busca mostra erro e permite tentar de novo', async () => {
  puxarBancoHorasMock
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(async () => {
      await upsertBancoHoras(database, bancoHorasFake());
    });

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar o banco de horas')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Tentar de novo'));

  await waitFor(() => expect(screen.getByText('-8h 00min')).toBeTruthy());
});

test('voltar devolve o controle para a tela de jornada', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Voltar')).toBeTruthy());

  await fireEvent.press(screen.getByText('Voltar'));

  expect(voltar).toHaveBeenCalled();
});
