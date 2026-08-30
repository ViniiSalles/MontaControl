// Automock inteiro trocaria também o `ErroApi` por um construtor vazio, e o
// teste da recusa da API perderia a `message` que a tela exibe.
jest.mock('../../../jornada/clienteJornadas', () => ({
  ...jest.requireActual('../../../jornada/clienteJornadas'),
  enviarSolicitacaoPonto: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { SolicitacaoPontoDTO } from '@montacontrol/shared';
import { ErroApi, enviarSolicitacaoPonto } from '../../../jornada/clienteJornadas';
import { ModalPontoEmAtraso } from '../ModalPontoEmAtraso';

const enviarMock = jest.mocked(enviarSolicitacaoPonto);
const fechar = jest.fn();

function renderizar(dataInicial: string | null = null) {
  return render(
    <ModalPontoEmAtraso token="access" dataInicial={dataInicial} aoFechar={fechar} />,
  );
}

async function preencher(campos: { entrada: string; saida: string; motivo: string; data?: string }) {
  if (campos.data) await fireEvent.changeText(screen.getByPlaceholderText('DD/MM/AAAA'), campos.data);
  await fireEvent.changeText(screen.getByPlaceholderText('08:00'), campos.entrada);
  await fireEvent.changeText(screen.getByPlaceholderText('17:00'), campos.saida);
  await fireEvent.changeText(
    screen.getByPlaceholderText('O que impediu de bater o ponto na hora'),
    campos.motivo,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('abre com a data do card já preenchida, em formato brasileiro', async () => {
  await renderizar('2026-08-26');

  expect(screen.getByPlaceholderText('DD/MM/AAAA').props.value).toBe('26/08/2026');
});

test('envia a solicitação com a data em ISO e o id do aparelho', async () => {
  enviarMock.mockResolvedValue({} as SolicitacaoPontoDTO);

  await renderizar('2026-08-26');
  await preencher({ entrada: '0800', saida: '1700', motivo: 'Celular sem bateria a manhã toda.' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  await waitFor(() =>
    expect(enviarMock).toHaveBeenCalledWith('access', {
      idCliente: '11111111-1111-4111-8111-111111111111',
      data: '2026-08-26',
      horaInicio: '08:00',
      horaFim: '17:00',
      justificativa: 'Celular sem bateria a manhã toda.',
    }),
  );
  expect(screen.getByText('Solicitação enviada')).toBeTruthy();
});

test('formulário inválido não chega à rede e aponta o campo', async () => {
  await renderizar('2026-08-26');
  await preencher({ entrada: '1700', saida: '0800', motivo: 'curto' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  expect(enviarMock).not.toHaveBeenCalled();
  expect(screen.getByText(/depois da entrada/i)).toBeTruthy();
  expect(screen.getByText(/pelo menos 10 caracteres/i)).toBeTruthy();
});

test('recusa da API aparece com a mensagem do servidor', async () => {
  enviarMock.mockRejectedValue(new ErroApi('PERIODO_JA_LANCADO', 'Já existe ponto neste dia.', 409));

  await renderizar('2026-08-26');
  await preencher({ entrada: '0800', saida: '1700', motivo: 'Celular sem bateria a manhã toda.' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  await waitFor(() => expect(screen.getByText('Já existe ponto neste dia.')).toBeTruthy());
});

test('falha de rede não é confundida com recusa de regra', async () => {
  enviarMock.mockRejectedValue(new TypeError('Network request failed'));

  await renderizar('2026-08-26');
  await preencher({ entrada: '0800', saida: '1700', motivo: 'Celular sem bateria a manhã toda.' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  await waitFor(() => expect(screen.getByText(/verifique a internet/i)).toBeTruthy());
});

test('cancelar fecha sem enviar nada', async () => {
  await renderizar();

  await fireEvent.press(screen.getByText('Cancelar'));

  expect(fechar).toHaveBeenCalled();
  expect(enviarMock).not.toHaveBeenCalled();
});
