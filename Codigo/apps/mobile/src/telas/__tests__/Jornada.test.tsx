jest.mock('../../auth/AuthContext');
jest.mock('../../jornada/acoes');
jest.mock('../../jornada/clienteJornadas');

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { useAuth } from '../../auth/AuthContext';
import { registrarCheckin, registrarCheckout } from '../../jornada/acoes';
import { buscarJornadaAtual } from '../../jornada/clienteJornadas';
import { formatarHora } from '../../jornada/formatacao';
import { montador } from '../../auth/__tests__/apoio';
import { Jornada } from '../Jornada';

const abrirHistorico = jest.fn();
const lancarEmAtraso = jest.fn();

function renderizar() {
  return render(<Jornada aoAbrirHistorico={abrirHistorico} aoLancarEmAtraso={lancarEmAtraso} />);
}

const useAuthMock = jest.mocked(useAuth);
const buscarJornadaAtualMock = jest.mocked(buscarJornadaAtual);
const registrarCheckinMock = jest.mocked(registrarCheckin);
const registrarCheckoutMock = jest.mocked(registrarCheckout);

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

beforeEach(() => {
  // `clearAllMocks` e não `resetAllMocks`: as implementações que o preset
  // jest-expo instala para os componentes nativos precisam sobreviver.
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({
    sessao: { accessToken: 'access', refreshToken: 'refresh', usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  buscarJornadaAtualMock.mockResolvedValue(null);
});

test('sem jornada aberta, a tela oferece o ponto de entrada', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy());
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.queryByText(ROTULO_SAIDA)).toBeNull();
});

test('jornada aberta mostra o check-in como último ponto e pede a saída', async () => {
  buscarJornadaAtualMock.mockResolvedValue(ABERTA);

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
  expect(registrarCheckinMock).toHaveBeenCalledWith('access');
  expect(screen.getByText(`Ponto de entrada registrado às ${HORA_CHECKIN}.`)).toBeTruthy();
  expect(screen.getByText(HORA_CHECKIN)).toBeTruthy();
});

test('bater a saída mantém o check-out na tela em vez de voltar ao estado vazio', async () => {
  buscarJornadaAtualMock.mockResolvedValue(ABERTA);
  registrarCheckoutMock.mockResolvedValue({ tipo: 'ok', jornada: ENCERRADA });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  // A jornada da resposta tem precedência sobre o GET: o ponto recém-batido
  // continua visível, e o botão volta a oferecer a entrada.
  await waitFor(() => expect(screen.getByText(HORA_CHECKOUT)).toBeTruthy());
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.queryByText('Nenhum ponto registrado')).toBeNull();
});

test('localização negada não registra ponto e instrui o montador', async () => {
  registrarCheckinMock.mockResolvedValue({ tipo: 'sem_localizacao', motivo: 'permissao_negada' });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(/ajustes do aparelho/i)).toBeTruthy());
  // Falhou: o botão continua oferecendo a entrada.
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy();
});

test('recusa da API aparece como erro sem trocar o estado do botão', async () => {
  buscarJornadaAtualMock.mockResolvedValue(ABERTA);
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
  buscarJornadaAtualMock.mockRejectedValue(new Error('offline'));

  await renderizar();

  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar sua jornada')).toBeTruthy(),
  );
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.getByText('Ver histórico')).toBeTruthy();
});

test('atualizar refaz a busca e limpa o aviso', async () => {
  buscarJornadaAtualMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(ABERTA);

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar sua jornada')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Atualizar'));

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(buscarJornadaAtualMock).toHaveBeenCalledTimes(2);
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
