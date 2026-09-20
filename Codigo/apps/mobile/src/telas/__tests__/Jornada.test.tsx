jest.mock('../../auth/AuthContext');
jest.mock('../../jornada/acoes');
jest.mock('../../sincronizacao/syncManager');

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { upsertBancoHoras } from '../../banco-horas/espelhoBancoHoras';
import { upsertJornadas } from '../../jornada/espelhoJornada';
import { useAuth } from '../../auth/AuthContext';
import { registrarCheckin, registrarCheckout } from '../../jornada/acoes';
import { iniciarSincronizacao, puxarBancoHoras, puxarJornadas } from '../../sincronizacao/syncManager';
import { formatarHora } from '../../jornada/formatacao';
import { periodoAtual } from '../../banco-horas/periodo';
import { montador } from '../../auth/__tests__/apoio';
import { Jornada } from '../Jornada';

const abrirHistorico = jest.fn();
const abrirBancoHoras = jest.fn();
const lancarEmAtraso = jest.fn();

let database = criarBancoDeTeste();

function renderizar() {
  return render(
    <DatabaseProvider database={database}>
      <Jornada
        aoAbrirHistorico={abrirHistorico}
        aoAbrirBancoHoras={abrirBancoHoras}
        aoLancarEmAtraso={lancarEmAtraso}
      />
    </DatabaseProvider>,
  );
}

const useAuthMock = jest.mocked(useAuth);
const registrarCheckinMock = jest.mocked(registrarCheckin);
const registrarCheckoutMock = jest.mocked(registrarCheckout);
const puxarJornadasMock = jest.mocked(puxarJornadas);
const puxarBancoHorasMock = jest.mocked(puxarBancoHoras);
const iniciarSincronizacaoMock = jest.mocked(iniciarSincronizacao);

/**
 * Check-in de duas horas atrás, e não uma data fixa: jornada aberta só conta
 * como "em andamento" dentro do limite de 24h (`estadoJornada`). Com data
 * congelada no passado a fixture nasceria vencida e o botão ofereceria
 * entrada em vez de saída.
 */
const CHECKIN_RECENTE = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const HORA_CHECKIN = formatarHora(CHECKIN_RECENTE);

const ABERTA: JornadaDTO = {
  id: 1,
  usuarioId: montador.id,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: CHECKIN_RECENTE,
  checkinLatitude: -19.9325,
  checkinLongitude: -43.9382,
  checkinEndereco: 'Av. Afonso Pena, 1000',
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: CHECKIN_RECENTE,
};

const CHECKOUT_RECENTE = new Date(Date.now() - 30 * 60 * 1000).toISOString();
const HORA_CHECKOUT = formatarHora(CHECKOUT_RECENTE);

const ENCERRADA: JornadaDTO = {
  ...ABERTA,
  status: StatusJornada.FINALIZADA,
  checkoutAt: CHECKOUT_RECENTE,
  checkoutLatitude: -19.94,
  checkoutLongitude: -43.94,
  checkoutEndereco: 'Rua da Bahia, 200',
};

const ROTULO_ENTRADA = 'Bater ponto de entrada';
const ROTULO_SAIDA = 'Bater ponto de saída';

const { mes: MES_ATUAL, ano: ANO_ATUAL } = periodoAtual(new Date().toISOString());

/** Saldo padrão do mês corrente — o default de todo teste que não testa o card em si. */
const BANCO_HORAS_PADRAO = {
  id: 1,
  usuarioId: montador.id,
  mes: MES_ATUAL,
  ano: ANO_ATUAL,
  horasTrabalhadas: 0,
  horasPrevistas: 168,
  saldo: -168,
};

beforeEach(async () => {
  // `clearAllMocks` e não `resetAllMocks`: as implementações que o preset
  // jest-expo instala para os componentes nativos precisam sobreviver.
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  await upsertBancoHoras(database, BANCO_HORAS_PADRAO);
  useAuthMock.mockReturnValue({
    sessao: { accessToken: 'access', refreshToken: 'refresh', usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  puxarJornadasMock.mockResolvedValue(undefined);
  puxarBancoHorasMock.mockResolvedValue(undefined);
  iniciarSincronizacaoMock.mockReturnValue(() => {});
});

test('sem jornada aberta, a tela oferece o ponto de entrada', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy());
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.queryByText(ROTULO_SAIDA)).toBeNull();
});

test('jornada aberta mostra o check-in como último ponto e pede a saída', async () => {
  await upsertJornadas(database, [ABERTA]);

  await renderizar();

  await waitFor(() => expect(screen.getByText(HORA_CHECKIN)).toBeTruthy());
  expect(screen.getByText('Av. Afonso Pena, 1000')).toBeTruthy();
  expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy();
});

test('bater a entrada registra o ponto e a tela passa a pedir a saída', async () => {
  registrarCheckinMock.mockResolvedValue({ tipo: 'ok', jornada: ABERTA });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(registrarCheckinMock).toHaveBeenCalledWith('access', database);
  expect(screen.getByText(`Ponto de entrada registrado às ${HORA_CHECKIN}.`)).toBeTruthy();
  expect(screen.getByText(HORA_CHECKIN)).toBeTruthy();
});

test('bater a saída mantém o check-out na tela em vez de voltar ao estado vazio', async () => {
  await upsertJornadas(database, [ABERTA]);
  registrarCheckoutMock.mockResolvedValue({ tipo: 'ok', jornada: ENCERRADA });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  // A jornada da resposta tem precedência sobre a leitura local: o ponto
  // recém-batido continua visível, e o botão volta a oferecer a entrada.
  await waitFor(() => expect(screen.getByText(HORA_CHECKOUT)).toBeTruthy());
  expect(registrarCheckoutMock).toHaveBeenCalledWith('access', database);
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.queryByText('Nenhum ponto registrado')).toBeNull();
});

test('localização negada não registra ponto e instrui o montador', async () => {
  registrarCheckinMock.mockResolvedValue({ tipo: 'sem_localizacao', motivo: 'permissao_negada' });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(/ajustes do aparelho/i)).toBeTruthy());
  expect(registrarCheckinMock).toHaveBeenCalledWith('access', database);
  // Falhou: o botão continua oferecendo a entrada.
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy();
});

test('recusa da API aparece como erro sem trocar o estado do botão', async () => {
  await upsertJornadas(database, [ABERTA]);
  registrarCheckoutMock.mockResolvedValue({ tipo: 'recusado', codigo: 'SEM_JORNADA_ABERTA' });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  await waitFor(() => expect(screen.getByText(/não há jornada aberta/i)).toBeTruthy());
  expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy();
});

// Regressão: a falha de leitura chegou a esconder o botão principal, e o
// montador ficava sem como registrar por causa de um GET que não voltou.
test('falha ao carregar avisa mas mantém o botão de bater ponto', async () => {
  puxarJornadasMock.mockRejectedValue(new Error('offline'));

  await renderizar();

  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar sua jornada')).toBeTruthy(),
  );
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.getByText('Ver histórico')).toBeTruthy();
});

test('atualizar refaz a busca e limpa o aviso', async () => {
  // Não dá para encadear `mockRejectedValueOnce().mockImplementationOnce()`
  // (padrão de "uma falha, depois um sucesso") aqui: `useJornadaAtual` E
  // `useHistoricoPontos` chamam `puxarJornadas` cada um na sua própria
  // montagem, então as duas primeiras chamadas já saem consumidas no mount
  // — antes de qualquer clique em "Atualizar". Em vez de contar chamadas,
  // troca-se o mock de comportamento entre as duas fases do teste.
  puxarJornadasMock.mockRejectedValue(new Error('offline'));

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar sua jornada')).toBeTruthy(),
  );

  puxarJornadasMock.mockImplementation(async () => {
    await upsertJornadas(database, [ABERTA]);
  });

  await fireEvent.press(screen.getByLabelText('Atualizar'));

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(screen.queryByText('Não foi possível carregar sua jornada')).toBeNull();
});

test('os atalhos de histórico e ponto em atraso chamam a navegação da aba', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText('Ver histórico'));
  expect(abrirHistorico).toHaveBeenCalled();

  await fireEvent.press(screen.getByText('Ponto em atraso'));
  expect(lancarEmAtraso).toHaveBeenCalled();
});

// Bug reportado: "trabalhadas hoje" resetava sempre que o montador abria um
// turno novo no mesmo dia, em vez de somar com o(s) turno(s) já fechados.
test('abrir um turno novo no mesmo dia soma com o turno anterior, não reseta "trabalhadas hoje"', async () => {
  // Hora fixa e bem longe da virada do dia civil (12:00 local): com
  // `Date.now()` puro, rodar o teste perto da meia-noite em
  // America/Sao_Paulo jogava o "checkin 5h atrás" pro dia civil anterior,
  // e "hoje" aparecia sem nenhum turno — falso negativo, não bug de produto.
  // `advanceTimers: true` é obrigatório com `waitFor`: sem isso o polling do
  // Testing Library nunca avança e a suíte trava (CI do PR fica em loop).
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2026-01-15T15:00:00.000Z'));

  const turno1Fechado: JornadaDTO = {
    id: 101,
    usuarioId: montador.id,
    status: StatusJornada.FINALIZADA,
    checkinAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    checkinLatitude: -19.9325,
    checkinLongitude: -43.9382,
    checkinEndereco: 'Av. Afonso Pena, 1000',
    checkoutAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // turno de 2h
    checkoutLatitude: -19.94,
    checkoutLongitude: -43.94,
    checkoutEndereco: 'Rua da Bahia, 200',
    lancadoEmAtraso: false,
    criadoEm: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  };
  await upsertJornadas(database, [turno1Fechado]);
  const turno2Aberto: JornadaDTO = { ...ABERTA, id: 102, checkinAt: new Date().toISOString() };
  registrarCheckinMock.mockResolvedValue({ tipo: 'ok', jornada: turno2Aberto });

  await renderizar();
  // Turno 1 (2h) já fechado, nenhuma jornada aberta ainda hoje.
  await waitFor(() => expect(screen.getByText('2h 00min')).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(registrarCheckinMock).toHaveBeenCalledWith('access', database);
  // Turno 2 acabou de abrir (poucos ms de duração): o total não pode cair
  // abaixo das 2h que o turno 1 já tinha — antes da correção, resetava a
  // "0h 00min" porque a tela só olhava para o turno aberto agora.
  expect(screen.getByText('2h 00min')).toBeTruthy();

  jest.useRealTimers();
});

test('o atalho de banco de horas chama a navegação da aba', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Ver histórico completo')).toBeTruthy());

  await fireEvent.press(screen.getByText('Ver histórico completo'));

  expect(abrirBancoHoras).toHaveBeenCalled();
});

test('Atualizar também refaz a busca do banco de horas', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Ver histórico completo')).toBeTruthy());

  expect(puxarBancoHorasMock).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByLabelText('Atualizar'));

  await waitFor(() => expect(puxarBancoHorasMock).toHaveBeenCalledTimes(2));
});

test('a sincronização automática liga ao montar a tela, com o banco e o token certos', async () => {
  await renderizar();

  await waitFor(() => expect(iniciarSincronizacaoMock).toHaveBeenCalledWith(database, 'access'));
});

test('bater a saída também refaz a busca do banco de horas', async () => {
  await upsertJornadas(database, [ABERTA]);
  registrarCheckoutMock.mockResolvedValue({ tipo: 'ok', jornada: ENCERRADA });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());

  expect(puxarBancoHorasMock).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  await waitFor(() => expect(puxarBancoHorasMock).toHaveBeenCalledTimes(2));
  expect(registrarCheckoutMock).toHaveBeenCalledWith('access', database);
});

test('ação descartada na fila aparece como aviso ao abrir a tela', async () => {
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = 'id-1';
      registro.payload = '{}';
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'descartada';
      registro.mensagemDescarte = 'Ação recusada: JORNADA_EM_ANDAMENTO.';
    }),
  );

  await renderizar();

  await waitFor(() =>
    expect(screen.getByText('Ação recusada: JORNADA_EM_ANDAMENTO.')).toBeTruthy(),
  );
});
