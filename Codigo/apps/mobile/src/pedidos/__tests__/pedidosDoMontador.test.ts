import { StatusAmbiente, StatusPeca, StatusPedido, syncPullFixture } from '@montacontrol/shared';
import { criarBancoDeTeste, gravarPullNaReplica } from '../../db/__tests__/apoio';
import { Ambiente } from '../../db/Ambiente';
import { Peca } from '../../db/Peca';
import { Pedido } from '../../db/Pedido';
import {
  montarPedidosDoMontador,
  paraAmbienteDoMontador,
  paraPecaDoMontador,
  paraPedidoDoMontador,
} from '../pedidosDoMontador';

async function lerDaReplica() {
  const database = criarBancoDeTeste();
  await gravarPullNaReplica(database, syncPullFixture);
  const [pedidos, ambientes, pecas] = await Promise.all([
    database.get<Pedido>('pedidos').query().fetch(),
    database.get<Ambiente>('ambientes').query().fetch(),
    database.get<Peca>('pecas').query().fetch(),
  ]);
  return {
    pedidos: pedidos.map(paraPedidoDoMontador),
    ambientes: ambientes.map(paraAmbienteDoMontador),
    pecas: pecas.map(paraPecaDoMontador),
  };
}

describe('montarPedidosDoMontador', () => {
  it('reconstrói o pedido com ambientes e peças a partir das linhas da réplica (ids numéricos)', async () => {
    const { pedidos, ambientes, pecas } = await lerDaReplica();

    const resultado = montarPedidosDoMontador(pedidos, ambientes, pecas);

    expect(resultado).toHaveLength(1);
    const [pedido] = resultado;
    expect(pedido).toMatchObject({
      id: 12,
      numeroPedido: 'PED-2026-0012',
      status: StatusPedido.EM_ENTREGA,
      clienteId: 3,
      cliente: {
        nome: 'Residencial Acácias',
        endereco: 'Rua das Acácias, 120',
        cidade: 'Belo Horizonte',
        estado: 'MG',
      },
    });
    expect(pedido.ambientes.map((ambiente) => [ambiente.id, ambiente.nome])).toEqual([
      [30, 'Cozinha'],
      [31, 'Quarto casal'],
    ]);
    expect(pedido.ambientes[0].status).toBe(StatusAmbiente.COMPLETO);
    expect(pedido.ambientes[1].pecas).toEqual([
      {
        id: 303,
        ambienteId: 31,
        codigoBarras: '7891000100127',
        descricao: 'Porta de correr 2,10m',
        quantidade: 2,
        status: StatusPeca.TRIADA,
      },
      {
        id: 304,
        ambienteId: 31,
        codigoBarras: null,
        descricao: 'Painel lateral guarda-roupa',
        quantidade: 1,
        status: StatusPeca.PENDENTE,
      },
    ]);
  });

  it('ordena os pedidos pelo número e ignora ambiente/peça de pedido que não está na réplica', async () => {
    const { pedidos, ambientes, pecas } = await lerDaReplica();
    const outro = { ...pedidos[0], id: 5, numeroPedido: 'PED-2026-0005' };

    const resultado = montarPedidosDoMontador([pedidos[0], outro], ambientes, pecas);

    expect(resultado.map((pedido) => pedido.numeroPedido)).toEqual([
      'PED-2026-0005',
      'PED-2026-0012',
    ]);
    expect(resultado[0].ambientes).toEqual([]);
    expect(resultado[1].ambientes).toHaveLength(2);
  });

  it('réplica vazia dá lista vazia', () => {
    expect(montarPedidosDoMontador([], [], [])).toEqual([]);
  });
});
