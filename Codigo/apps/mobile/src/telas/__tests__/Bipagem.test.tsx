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
jest.mock('../../jornada/useObraEmTrabalho', () => ({ useObraEmTrabalho: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StatusAmbiente, StatusPeca, StatusPedido } from '@montacontrol/shared';
import type { PedidoDoMontadorDTO } from '@montacontrol/shared';
import { useDadosConferencia } from '../../conferencia/useDadosConferencia';
import { useObraEmTrabalho } from '../../jornada/useObraEmTrabalho';
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
const irParaJornada = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useDadosConferencia).mockReturnValue({
    pedidos: PEDIDOS,
    leiturasNaFila: [],
    carregando: false,
    erro: false,
    recarregar: jest.fn(),
  });
  // Ponto aberto na obra do PED-1: é o pedido conferido.
  jest.mocked(useObraEmTrabalho).mockReturnValue({ obra: PEDIDOS[0], motivo: null, carregando: false });
});

async function digitarCodigo(codigo: string) {
  await fireEvent.press(screen.getByText('Digitar código manualmente'));
  await fireEvent.changeText(screen.getByPlaceholderText('Digite o código da etiqueta'), codigo);
  await fireEvent.press(screen.getByText('Conferir'));
}

test('mostra o progresso e o checklist do pedido ativo', async () => {
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);

  expect(screen.getByText('STATUS DA BIPAGEM')).toBeTruthy();
  expect(screen.getByText('Faltam 1'.toUpperCase())).toBeTruthy();
  expect(screen.getByText('Painel lateral')).toBeTruthy();
});

test('N4T1: peça do pedido ativo é conferida e a leitura vai para a fila', async () => {
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);
  await digitarCodigo('COD-A');

  expect(screen.getByText('CONFERIDA')).toBeTruthy();
  expect(executarAcaoConferencia).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ pedidoId: 1, codigoBarras: 'COD-A', idCliente: 'uuid-leitura' }),
  );
});

test('N4T2: peça de outro pedido dispara o alerta de inconsistência', async () => {
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);
  await digitarCodigo('COD-X');

  expect(screen.getByText('Peça de outro pedido — não descarregue')).toBeTruthy();
  expect(executarAcaoConferencia).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ pedidoId: 1, codigoBarras: 'COD-X' }),
  );
});

test('confere o pedido da obra em trabalho, não o primeiro da réplica', async () => {
  jest.mocked(useObraEmTrabalho).mockReturnValue({ obra: PEDIDOS[1], motivo: null, carregando: false });
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);
  await digitarCodigo('COD-X');

  expect(screen.getByText('CONFERIDA')).toBeTruthy();
  expect(executarAcaoConferencia).toHaveBeenCalledWith(
    {},
    expect.objectContaining({ pedidoId: 2, codigoBarras: 'COD-X' }),
  );
});

test('não oferece escolher pedido: a obra aparece só para leitura', async () => {
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);

  expect(screen.getByText('Cliente 1')).toBeTruthy();
  expect(screen.queryByText('PEDIDO EM DESCARREGAMENTO')).toBeNull();
  expect(screen.queryByText('Trocar')).toBeNull();
});

test('sem ponto aberto, bloqueia e leva à Jornada', async () => {
  jest.mocked(useObraEmTrabalho).mockReturnValue({ obra: null, motivo: 'sem_ponto', carregando: false });
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);

  expect(screen.getByText('Bata o ponto de entrada para conferir peças')).toBeTruthy();
  expect(screen.queryByText('Digitar código manualmente')).toBeNull();
  await fireEvent.press(screen.getByText('Ir para a Jornada'));
  expect(irParaJornada).toHaveBeenCalled();
});

test('obra do ponto sem as peças no aparelho pede para sincronizar', async () => {
  jest.mocked(useObraEmTrabalho).mockReturnValue({
    obra: { id: 99, numeroPedido: 'PED-99', cliente: PEDIDOS[0].cliente },
    motivo: null,
    carregando: false,
  });
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);

  expect(screen.getByText('Dados da obra fora do aparelho')).toBeTruthy();
});

test('enquanto a obra carrega, mostra o carregamento e não o bloqueio', async () => {
  jest.mocked(useObraEmTrabalho).mockReturnValue({ obra: null, motivo: 'sem_ponto', carregando: true });
  await render(<Bipagem aoIrParaJornada={irParaJornada} />);

  expect(screen.queryByText('Bata o ponto de entrada para conferir peças')).toBeNull();
  expect(screen.queryByText('Ir para a Jornada')).toBeNull();
});
