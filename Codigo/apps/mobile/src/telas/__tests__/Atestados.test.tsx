jest.mock('../../atestados/clienteAtestados', () => ({ enviarAtestado: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

import { Alert } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StatusAtestado, syncPullFixture } from '@montacontrol/shared';
import type { SyncAtestadoRow } from '@montacontrol/shared';
import { enviarAtestado } from '../../atestados/clienteAtestados';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste, gravarLinhasNaReplica } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { apagarTodasAsFotos } from '../../fotos/armazenamentoFotos';
import { criarFotoDoPicker } from '../../fotos/__tests__/apoio';
import {
  atualizarStatusDaSincronizacao,
  reiniciarStatusDaSincronizacao,
} from '../../sincronizacao/statusDaSincronizacao';
import { Atestados } from '../Atestados';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const enviarMock = jest.mocked(enviarAtestado);
const ID_DO_APARELHO = '11111111-1111-4111-8111-111111111111';
const fetchMock = jest.fn();

let database: ReturnType<typeof criarBancoDeTeste>;

function linhaDeAtestado(parcial: Partial<SyncAtestadoRow> = {}): SyncAtestadoRow {
  return {
    id: '1',
    id_cliente: 'atestado-1',
    data_inicio: '2026-09-01',
    data_fim: '2026-09-03',
    observacao: null,
    status: StatusAtestado.PENDENTE,
    motivo_rejeicao: null,
    validado_em: null,
    criado_em: '2026-09-01T12:00:00.000Z',
    ...parcial,
  };
}

async function semearAtestados(...linhas: SyncAtestadoRow[]) {
  await gravarLinhasNaReplica(database, 'atestados', linhas);
}

function renderizar() {
  return render(<Atestados />, { wrapper: comBanco(database) });
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens(null);
  reiniciarStatusDaSincronizacao();
  database = criarBancoDeTeste();
  jest.mocked(randomUUID).mockReturnValue(ID_DO_APARELHO);
});

afterEach(async () => {
  await apagarTodasAsFotos();
});

test('lista os atestados da réplica com o rótulo de situação de cada um', async () => {
  await semearAtestados(
    linhaDeAtestado({ id: '1', id_cliente: 'a', status: StatusAtestado.PENDENTE }),
    linhaDeAtestado({ id: '2', id_cliente: 'b', status: StatusAtestado.VALIDADO }),
    linhaDeAtestado({
      id: '3',
      id_cliente: 'c',
      status: StatusAtestado.REJEITADO,
      motivo_rejeicao: 'Foto ilegível',
    }),
  );

  await renderizar();

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
  expect(screen.getByText('APROVADO')).toBeTruthy();
  expect(screen.getByText('RECUSADO')).toBeTruthy();
  expect(screen.getByText('Foto ilegível')).toBeTruthy();
  expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull();
});

test('sem atestados mostra o estado vazio', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());
});

test('réplica vazia depois de uma sincronização que falhou pede para conectar e permite tentar de novo', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());

  await act(async () => {
    atualizarStatusDaSincronizacao({ ultimoErro: 'sem_rede' });
  });

  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar seus atestados')).toBeTruthy(),
  );
  expect(screen.getByText('Tentar de novo')).toBeTruthy();
});

test('mostra o período no formato curto e o aviso LGPD', async () => {
  await semearAtestados(linhaDeAtestado({ data_inicio: '2026-10-15', data_fim: '2026-10-17' }));

  await renderizar();

  await waitFor(() => expect(screen.getByText('15/10 a 17/10 (3 dias)')).toBeTruthy());
  expect(screen.getByText('HISTÓRICO RECENTE')).toBeTruthy();
  expect(screen.getByText(/Aviso LGPD/)).toBeTruthy();
});

test('o formulário aparece direto, sem tocar em "Novo atestado" e sem depender da rede', async () => {
  await renderizar();

  expect(screen.getByText('Enviar Atestado')).toBeTruthy();
  expect(screen.queryByText('Novo atestado')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

async function anexarFotoEPreencher() {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementation(async () => ({
    canceled: false,
    assets: [{ uri: criarFotoDoPicker(), mimeType: 'image/jpeg' } as never],
  }));
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[0], '01092026');
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[1], '03092026');
  const espiaAlerta = jest.spyOn(Alert, 'alert');
  await fireEvent.press(screen.getByLabelText('Fotografar Atestado'));
  const botoes = espiaAlerta.mock.calls[espiaAlerta.mock.calls.length - 1][2] ?? [];
  await botoes.find((botao) => botao.text === 'Escolher da galeria')?.onPress?.(undefined as never);
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());
}

test('enviar com observação avisa, zera o formulário e já mostra o atestado na lista (sem esperar o pull)', async () => {
  enviarMock.mockResolvedValue({} as never);
  await renderizar();
  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());
  await anexarFotoEPreencher();
  await fireEvent.changeText(screen.getByPlaceholderText(/Descreva brevemente/), 'Dor lombar');

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  await waitFor(() =>
    expect(enviarMock).toHaveBeenCalledWith(
      expect.objectContaining({ observacao: 'Dor lombar', dataInicio: '2026-09-01' }),
    ),
  );
  await waitFor(() => expect(screen.getByText('Atestado enviado. O RH vai analisar.')).toBeTruthy());
  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
  expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull();
});

test('sem rede o atestado fica na lista com o selo "Aguardando envio"', async () => {
  enviarMock.mockRejectedValue(new TypeError('Network request failed'));
  await renderizar();
  await anexarFotoEPreencher();

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  await waitFor(() =>
    expect(
      screen.getByText('Sem conexão agora: o atestado foi salvo e será enviado automaticamente.'),
    ).toBeTruthy(),
  );
  await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
  expect(screen.getByText('01/09 a 03/09 (3 dias)')).toBeTruthy();
  expect(screen.queryByText('Nenhum atestado enviado ainda.')).toBeNull();
});

function atestadosFake(quantidade: number): SyncAtestadoRow[] {
  return Array.from({ length: quantidade }, (_, i) =>
    linhaDeAtestado({
      id: String(i + 1),
      id_cliente: `atestado-${i + 1}`,
      criado_em: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
    }),
  );
}

test('com mais de 5 atestados mostra só 5 cartões e o botão "Ver todos (N)"', async () => {
  await semearAtestados(...atestadosFake(7));

  await renderizar();

  await waitFor(() => expect(screen.getByText('Ver todos (7)')).toBeTruthy());
  expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(5);
});

test('tocar em "Ver todos" mostra a lista inteira e o botão vira "Ver menos"', async () => {
  await semearAtestados(...atestadosFake(7));

  await renderizar();
  await fireEvent.press(await screen.findByText('Ver todos (7)'));

  expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(7);
  expect(screen.getByText('Ver menos')).toBeTruthy();

  await fireEvent.press(screen.getByText('Ver menos'));

  expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(5);
  expect(screen.getByText('Ver todos (7)')).toBeTruthy();
});

test('com 5 atestados ou menos não mostra o botão de expandir', async () => {
  await semearAtestados(...atestadosFake(5));

  await renderizar();

  await waitFor(() => expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(5));
  expect(screen.queryByText(/Ver todos/)).toBeNull();
  expect(screen.queryByText('Ver menos')).toBeNull();
});

test('o aviso de sucesso some quando um novo envio começa', async () => {
  enviarMock.mockResolvedValueOnce({} as never).mockRejectedValueOnce(new TypeError('offline'));
  await renderizar();
  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());

  await anexarFotoEPreencher();
  await fireEvent.press(screen.getByText('Enviar Atestado'));
  await waitFor(() => expect(screen.getByText('Atestado enviado. O RH vai analisar.')).toBeTruthy());

  jest.mocked(randomUUID).mockReturnValue('22222222-2222-4222-8222-222222222222');
  await anexarFotoEPreencher();
  await fireEvent.press(screen.getByText('Enviar Atestado'));
  await waitFor(() =>
    expect(
      screen.getByText('Sem conexão agora: o atestado foi salvo e será enviado automaticamente.'),
    ).toBeTruthy(),
  );
  expect(screen.queryByText('Atestado enviado. O RH vai analisar.')).toBeNull();
});

test('o atestado do pull substitui o da fila pelo idCliente (uma linha só)', async () => {
  enviarMock.mockResolvedValue({} as never);
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  await renderizar();
  await anexarFotoEPreencher();
  await fireEvent.press(screen.getByText('Enviar Atestado'));
  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());

  // O pull que o envio dispara traz o atestado com o idCliente do aparelho.
  const pull = {
    ...syncPullFixture,
    changes: {
      ...Object.fromEntries(
        Object.entries(syncPullFixture.changes).map(([tabela]) => [
          tabela,
          { created: [], updated: [], deleted: [] },
        ]),
      ),
      atestados: {
        created: [],
        updated: [
          linhaDeAtestado({
            id: '50',
            id_cliente: ID_DO_APARELHO,
            status: StatusAtestado.VALIDADO,
            criado_em: '2026-10-17T10:00:00.000Z',
          }),
        ],
        deleted: [],
      },
    },
  };
  fetchMock.mockResolvedValue(respostaJson(200, pull));
  await act(async () => {
    await jest
      .requireActual<typeof import('../../sincronizacao/syncManager')>('../../sincronizacao/syncManager')
      .executarSincronizacao(database);
  });

  await waitFor(() => expect(screen.getByText('APROVADO')).toBeTruthy());
  expect(screen.queryByText('EM ANÁLISE')).toBeNull();
  expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull();
});
