import { StatusAmbiente, StatusPeca, StatusPedido } from '@montacontrol/shared';
import type { PecaDTO, PedidoDoMontadorDTO } from '@montacontrol/shared';
import {
  classificarLeitura,
  deveEnfileirar,
  montarConferencia,
} from '../conferencia';

function peca(id: number, ambienteId: number, codigoBarras: string | null, status: StatusPeca): PecaDTO {
  return { id, ambienteId, codigoBarras, descricao: `Peça ${id}`, quantidade: 1, status };
}

function pedido(id: number, numeroPedido: string, ambientes: PedidoDoMontadorDTO['ambientes']): PedidoDoMontadorDTO {
  return {
    id,
    numeroPedido,
    status: StatusPedido.EM_ENTREGA,
    clienteId: 1,
    cliente: { nome: 'Cliente', endereco: 'Rua A', cidade: 'BH', estado: 'MG', latitude: 0, longitude: 0 },
    ambientes,
  };
}

const ATIVO = pedido(1, 'PED-1', [
  {
    id: 10,
    nome: 'Cozinha',
    status: StatusAmbiente.PENDENTE,
    pecas: [
      peca(100, 10, 'COD-A', StatusPeca.TRIADA),
      peca(101, 10, 'COD-B', StatusPeca.DESCARREGADA),
    ],
  },
  {
    id: 11,
    nome: 'Quarto',
    status: StatusAmbiente.PENDENTE,
    pecas: [
      peca(102, 11, 'COD-C', StatusPeca.INCONSISTENTE),
      peca(103, 11, null, StatusPeca.PENDENTE),
    ],
  },
]);

const OUTRO = pedido(2, 'PED-2', [
  { id: 20, nome: 'Sala', status: StatusAmbiente.PENDENTE, pecas: [peca(200, 20, 'COD-X', StatusPeca.TRIADA)] },
]);

describe('montarConferencia', () => {
  it('conta só DESCARREGADA e leituras na fila como conferidas', () => {
    const conferencia = montarConferencia(ATIVO, []);

    expect(conferencia.total).toBe(4);
    expect(conferencia.conferidas).toBe(1);
    expect(conferencia.ambientes[1].pecas.map((item) => item.situacao)).toEqual([
      'inconsistente',
      'sem_codigo',
    ]);
  });

  it('N4T3: leitura ainda na fila aparece conferida, aguardando envio', () => {
    const conferencia = montarConferencia(ATIVO, [
      { pedidoId: 1, codigoBarras: 'COD-A' },
      { pedidoId: 2, codigoBarras: 'COD-C' },
    ]);

    expect(conferencia.ambientes[0].pecas[0].situacao).toBe('aguardando_envio');
    // A leitura de outro pedido não confere peça deste.
    expect(conferencia.ambientes[1].pecas[0].situacao).toBe('inconsistente');
    expect(conferencia.conferidas).toBe(2);
  });
});

describe('classificarLeitura', () => {
  const pedidos = [ATIVO, OUTRO];

  it('N4T1: peça do pedido ativo é conferida e avisa quando fecha o ambiente', () => {
    const resultado = classificarLeitura('COD-A', montarConferencia(ATIVO, []), pedidos);

    expect(resultado).toMatchObject({ tipo: 'conferida', ambiente: 'Cozinha', ambienteCompleto: true });
  });

  it('peça inconsistente lida no pedido certo é conferida', () => {
    const resultado = classificarLeitura('COD-C', montarConferencia(ATIVO, []), pedidos);

    expect(resultado).toMatchObject({ tipo: 'conferida', ambienteCompleto: false });
  });

  it('peça já descarregada não conta duas vezes', () => {
    expect(classificarLeitura('COD-B', montarConferencia(ATIVO, []), pedidos).tipo).toBe('ja_conferida');
  });

  it('N4T2: peça de outro pedido do montador é apontada com o número do pedido', () => {
    const resultado = classificarLeitura('COD-X', montarConferencia(ATIVO, []), pedidos);

    expect(resultado).toMatchObject({ tipo: 'outro_pedido', numeroPedido: 'PED-2' });
  });

  it('código desconhecido no aparelho é nao_encontrada', () => {
    expect(classificarLeitura('COD-?', montarConferencia(ATIVO, []), pedidos).tipo).toBe('nao_encontrada');
  });
});

describe('deveEnfileirar', () => {
  it('não reenfileira a mesma leitura nem peça já conferida', () => {
    const conferencia = montarConferencia(ATIVO, []);
    const naFila = [{ pedidoId: 1, codigoBarras: 'COD-?' }];

    expect(deveEnfileirar(classificarLeitura('COD-A', conferencia, [ATIVO]), 1, naFila)).toBe(true);
    expect(deveEnfileirar(classificarLeitura('COD-?', conferencia, [ATIVO]), 1, naFila)).toBe(false);
    expect(deveEnfileirar(classificarLeitura('COD-B', conferencia, [ATIVO]), 1, [])).toBe(false);
  });
});
