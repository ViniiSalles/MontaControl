jest.mock('../../auth/AuthContext');
jest.mock('../../avarias/clienteAvarias', () => ({
  listarMeusPedidos: jest.fn(),
  listarTiposAvaria: jest.fn(),
  listarMinhasAvarias: jest.fn(),
  enviarAvaria: jest.fn(),
}));
jest.mock('../../sincronizacao/outbox', () => ({ executarAcaoAvaria: jest.fn() }));
jest.mock('../../db/useDatabase', () => ({ useDatabaseOuFalha: () => ({}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Perfil, StatusAmbiente, StatusAvaria, StatusPeca, StatusPedido } from '@montacontrol/shared';
import type { AvariaDTO, PedidoComAmbientesDTO } from '@montacontrol/shared';
import { useAuth } from '../../auth/AuthContext';
import { listarMeusPedidos, listarMinhasAvarias, listarTiposAvaria } from '../../avarias/clienteAvarias';
import { executarAcaoAvaria } from '../../sincronizacao/outbox';
import { montador } from '../../auth/__tests__/apoio';
import { Avarias } from '../Avarias';

const pedidosMock = jest.mocked(listarMeusPedidos);
const tiposMock = jest.mocked(listarTiposAvaria);
const minhasMock = jest.mocked(listarMinhasAvarias);
const executarMock = jest.mocked(executarAcaoAvaria);

const PEDIDO: PedidoComAmbientesDTO = {
  id: 1,
  numeroPedido: 'PED-000001',
  status: StatusPedido.ENTREGUE,
  clienteId: 1,
  ambientes: [
    {
      id: 1,
      nome: 'Cozinha',
      status: StatusAmbiente.COMPLETO,
      pecas: [
        {
          id: 10,
          codigoBarras: '789',
          descricao: 'Porta de armário',
          quantidade: 1,
          status: StatusPeca.ENTREGUE,
          ambienteId: 1,
        },
      ],
    },
  ],
};

function avariaFake(parcial: Partial<AvariaDTO> = {}): AvariaDTO {
  return {
    id: 1,
    pecaId: 10,
    descricaoPeca: 'Porta de armário',
    codigoBarras: '789',
    pedidoId: 1,
    numeroPedido: 'PED-000001',
    ambiente: 'Cozinha',
    tipoAvariaId: 2,
    tipoAvaria: 'Risco',
    descricao: 'Riscada',
    status: StatusAvaria.REPORTADA,
    registradaPor: montador.id,
    registradaPorNome: montador.nome,
    registradaPorPerfil: Perfil.MONTADOR,
    analisadaPor: null,
    analisadaEm: null,
    parecer: null,
    quantidadeFotos: 0,
    criadoEm: '2026-10-05T12:00:00.000Z',
    ...parcial,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    sessao: { accessToken: 'access', refreshToken: 'refresh', usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  pedidosMock.mockResolvedValue([PEDIDO]);
  tiposMock.mockResolvedValue([
    { id: 2, nome: 'Risco', descricao: 'Marca no acabamento' },
    { id: 5, nome: 'Faltante', descricao: 'Peça não veio' },
  ]);
  minhasMock.mockResolvedValue([]);
});

test('lista os reportes com situação e parecer do gestor', async () => {
  minhasMock.mockResolvedValue([
    avariaFake({ id: 1, status: StatusAvaria.EM_ANALISE }),
    avariaFake({ id: 2, status: StatusAvaria.RESOLVIDA, parecer: 'Peça reposta' }),
  ]);

  await render(<Avarias />);

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
  expect(screen.getByText('RESOLVIDA')).toBeTruthy();
  expect(screen.getByText('Gestor: Peça reposta')).toBeTruthy();
});

test('sem pedido vinculado não mostra o formulário', async () => {
  pedidosMock.mockResolvedValue([]);

  await render(<Avarias />);

  await waitFor(() => expect(screen.getByText('Nenhum pedido vinculado')).toBeTruthy());
  expect(screen.queryByText('Enviar problema')).toBeNull();
});

test('enviar sem escolher peça e tipo mostra os erros e não envia', async () => {
  await render(<Avarias />);
  await waitFor(() => expect(screen.getByText('Enviar problema')).toBeTruthy());

  await fireEvent.press(screen.getByText('Enviar problema'));

  expect(screen.getByText('Selecione a peça com problema.')).toBeTruthy();
  expect(screen.getByText('Selecione o tipo de problema.')).toBeTruthy();
  expect(executarMock).not.toHaveBeenCalled();
});

test('com pedido único, escolhe peça e tipo e envia pela outbox', async () => {
  executarMock.mockResolvedValue({ tipo: 'enviada' });
  await render(<Avarias />);
  await waitFor(() => expect(screen.getByText('Porta de armário')).toBeTruthy());

  await fireEvent.press(screen.getByText('Porta de armário'));
  await fireEvent.press(screen.getByText('Faltante'));
  await fireEvent.changeText(screen.getByPlaceholderText('O que aconteceu com a peça?'), 'Não veio na entrega');
  await fireEvent.press(screen.getByText('Enviar problema'));

  await waitFor(() => expect(screen.getByText('Problema enviado. O gestor vai analisar.')).toBeTruthy());
  expect(executarMock).toHaveBeenCalledWith({}, 'access', {
    idCliente: '11111111-1111-4111-8111-111111111111',
    pecaId: 10,
    tipoAvariaId: 5,
    descricao: 'Não veio na entrega',
  });
});

test('sem rede avisa que o reporte foi salvo para envio automático', async () => {
  executarMock.mockResolvedValue({ tipo: 'pendente' });
  await render(<Avarias />);
  await waitFor(() => expect(screen.getByText('Porta de armário')).toBeTruthy());

  await fireEvent.press(screen.getByText('Porta de armário'));
  await fireEvent.press(screen.getByText('Risco'));
  await fireEvent.changeText(screen.getByPlaceholderText('O que aconteceu com a peça?'), 'Lateral riscada');
  await fireEvent.press(screen.getByText('Enviar problema'));

  await waitFor(() =>
    expect(
      screen.getByText('Sem conexão agora: o problema foi salvo e será enviado automaticamente.'),
    ).toBeTruthy(),
  );
});

test('recusa do servidor mostra a mensagem e mantém o formulário', async () => {
  executarMock.mockResolvedValue({ tipo: 'recusado', codigo: 'X', mensagem: 'Peça não encontrada' });
  await render(<Avarias />);
  await waitFor(() => expect(screen.getByText('Porta de armário')).toBeTruthy());

  await fireEvent.press(screen.getByText('Porta de armário'));
  await fireEvent.press(screen.getByText('Risco'));
  await fireEvent.changeText(screen.getByPlaceholderText('O que aconteceu com a peça?'), 'Lateral riscada');
  await fireEvent.press(screen.getByText('Enviar problema'));

  await waitFor(() => expect(screen.getByText('Peça não encontrada')).toBeTruthy());
});
