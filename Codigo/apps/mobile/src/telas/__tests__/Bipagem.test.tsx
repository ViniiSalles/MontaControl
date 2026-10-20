jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-leitura' }));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));
jest.mock('../../db/useDatabase', () => ({ useDatabaseOuFalha: () => ({}) }));
jest.mock('../../sincronizacao/outbox', () => ({
  executarAcaoConferencia: jest.fn().mockResolvedValue({ tipo: 'pendente' }),
}));
jest.mock('../../conferencia/useDadosConferencia', () => ({ useDadosConferencia: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StatusAmbiente, StatusPeca, StatusPedido } from '@montacontrol/shared';
import type { PedidoDoMontadorDTO } from '@montacontrol/shared';
import { useDadosConferencia } from '../../conferencia/useDadosConferencia';
import { executarAcaoConferencia } from '../../sincronizacao/outbox';
import { Bipagem } from '../Bipagem';

function pedido(id: number, numeroPedido: string, codigo: string): PedidoDoMontadorDTO {
  return {
    id,
    numeroPedido,
    status: StatusPedido.EM_ENTREGA,
    clienteId: id,
    cliente: { nome: `Cliente ${id}`, endereco: 'Rua A', cidade: 'BH', estado: 'MG', latitude: 0, longitude: 0 },
    ambientes: [
      {
        id: id * 10,
        nome: 'Cozinha',
        status: StatusAmbiente.PENDENTE,
        pecas: [
          {
            id: id * 100,
            ambienteId: id * 10,
            codigoBarras: codigo,
            descricao: 'Painel lateral',
            quantidade: 1,
            status: StatusPeca.TRIADA,
          },
        ],
      },
    ],
  };
}

const PEDIDOS = [pedido(1, 'PED-1', 'COD-A'), pedido(2, 'PED-2', 'COD-X')];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useDadosConferencia).mockReturnValue({
    pedidos: PEDIDOS,
    leiturasNaFila: [],
    carregando: false,
    erro: false,
    recarregar: jest.fn(),
  });
});

async function digitarCodigo(codigo: string) {
  await fireEvent.press(screen.getByText('Digitar código manualmente'));
  await fireEvent.changeText(screen.getByPlaceholderText('Digite o código da etiqueta'), codigo);
  await fireEvent.press(screen.getByText('Conferir'));
}

test('mostra o progresso e o checklist do pedido ativo', async () => {
  await render(<Bipagem />);

  expect(screen.getByText('STATUS DA BIPAGEM')).toBeTruthy();
  expect(screen.getByText('Faltam 1'.toUpperCase())).toBeTruthy();
  expect(screen.getByText('Painel lateral')).toBeTruthy();
});

test('N4T1: peça do pedido ativo é conferida e a leitura vai para a fila', async () => {
  await render(<Bipagem />);
  await digitarCodigo('COD-A');

  expect(screen.getByText('CONFERIDA')).toBeTruthy();
  expect(executarAcaoConferencia).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ pedidoId: 1, codigoBarras: 'COD-A', idCliente: 'uuid-leitura' }),
  );
});

test('N4T2: peça de outro pedido dispara o alerta de inconsistência', async () => {
  await render(<Bipagem />);
  await digitarCodigo('COD-X');

  expect(screen.getByText('Peça de outro pedido — não descarregue')).toBeTruthy();
  expect(executarAcaoConferencia).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ pedidoId: 1, codigoBarras: 'COD-X' }),
  );
});
