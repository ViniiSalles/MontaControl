jest.mock('../../../sincronizacao/outbox', () => ({
  executarAcaoPontoEmAtraso: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DatabaseProvider from '@nozbe/watermelondb/react/DatabaseProvider';
import { executarAcaoPontoEmAtraso } from '../../../sincronizacao/outbox';
import { criarBancoDeTeste } from '../../../db/__tests__/apoio';
import { ModalPontoEmAtraso } from '../ModalPontoEmAtraso';

const executarMock = jest.mocked(executarAcaoPontoEmAtraso);
const fechar = jest.fn();
let database: ReturnType<typeof criarBancoDeTeste>;

function renderizar(dataInicial: string | null = null) {
  return render(
    <DatabaseProvider database={database}>
      <ModalPontoEmAtraso dataInicial={dataInicial} aoFechar={fechar} />
    </DatabaseProvider>,
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
  database = criarBancoDeTeste();
});

test('abre com a data do card já preenchida, em formato brasileiro', async () => {
  await renderizar('2026-08-26');

  expect(screen.getByPlaceholderText('DD/MM/AAAA').props.value).toBe('26/08/2026');
});

test('envia a solicitação com a data em ISO e o id do aparelho', async () => {
  executarMock.mockResolvedValue({ tipo: 'ok' });

  await renderizar('2026-08-26');
  await preencher({ entrada: '0800', saida: '1700', motivo: 'Celular sem bateria a manhã toda.' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  await waitFor(() =>
    expect(executarMock).toHaveBeenCalledWith(
      expect.anything(), // database
      {
        idCliente: '11111111-1111-4111-8111-111111111111',
        data: '2026-08-26',
        horaInicio: '08:00',
        horaFim: '17:00',
        justificativa: 'Celular sem bateria a manhã toda.',
      },
    ),
  );
  expect(screen.getByText('Solicitação enviada')).toBeTruthy();
});

test('formulário inválido não chega à rede e aponta o campo', async () => {
  await renderizar('2026-08-26');
  await preencher({ entrada: '1700', saida: '0800', motivo: 'curto' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  expect(executarMock).not.toHaveBeenCalled();
  expect(screen.getByText(/depois da entrada/i)).toBeTruthy();
  expect(screen.getByText(/pelo menos 10 caracteres/i)).toBeTruthy();
});

test('recusa da API aparece com a mensagem padrão', async () => {
  executarMock.mockResolvedValue({ tipo: 'recusado', codigo: 'PERIODO_JA_LANCADO' });

  await renderizar('2026-08-26');
  await preencher({ entrada: '0800', saida: '1700', motivo: 'Celular sem bateria a manhã toda.' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  await waitFor(() => expect(screen.getByText('O pedido foi recusado. Confira os dados e tente de novo.')).toBeTruthy());
});

test('offline: mesmo sem confirmação do servidor, mostra a tela de enviada', async () => {
  executarMock.mockResolvedValue({ tipo: 'ok' });

  await renderizar('2026-08-26');
  await preencher({ entrada: '0800', saida: '1700', motivo: 'Celular sem bateria a manhã toda.' });

  await fireEvent.press(screen.getByText('Enviar solicitação'));

  await waitFor(() => expect(screen.getByText('Solicitação enviada')).toBeTruthy());
});

test('cancelar fecha sem enviar nada', async () => {
  await renderizar();

  await fireEvent.press(screen.getByText('Cancelar'));

  expect(fechar).toHaveBeenCalled();
  expect(executarMock).not.toHaveBeenCalled();
});
