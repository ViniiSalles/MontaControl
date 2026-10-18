import { StatusAmbiente, StatusAvaria, StatusPeca, StatusPedido } from '@montacontrol/shared';
import type { PedidoDoMontadorDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { montarAvariasExibidas } from '../avariasComPendentes';
import type { AvariaDaReplica, AvariaNaFila } from '../avariasComPendentes';

const PEDIDOS: PedidoDoMontadorDTO[] = [
  {
    id: 12,
    numeroPedido: 'PED-2026-0012',
    status: StatusPedido.EM_ENTREGA,
    clienteId: 3,
    cliente: {
      nome: 'Residencial Acácias',
      endereco: 'Rua das Acácias, 120',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      latitude: -19.9,
      longitude: -43.9,
    },
    ambientes: [
      {
        id: 31,
        nome: 'Quarto casal',
        status: StatusAmbiente.EM_PROGRESSO,
        pecas: [
          {
            id: 303,
            ambienteId: 31,
            codigoBarras: '7891000100127',
            descricao: 'Porta de correr 2,10m',
            quantidade: 2,
            status: StatusPeca.TRIADA,
          },
        ],
      },
    ],
  },
];

const TIPOS: TipoAvariaDTO[] = [
  { id: 1, nome: 'Peça danificada', descricao: '' },
  { id: 2, nome: 'Peça faltando', descricao: '' },
];

function daReplica(parcial: Partial<AvariaDaReplica> = {}): AvariaDaReplica {
  return {
    id: '77',
    idCliente: 'id-77',
    pecaDescricao: 'Porta de correr 2,10m',
    ambienteNome: 'Quarto casal',
    numeroPedido: 'PED-2026-0012',
    tipoAvariaId: 1,
    status: StatusAvaria.EM_ANALISE,
    parecer: null,
    criadoEm: '2026-10-16T14:20:00.000Z',
    ...parcial,
  };
}

function naFila(parcial: Partial<AvariaNaFila> = {}): AvariaNaFila {
  return {
    idCliente: 'id-novo',
    status: 'pendente',
    criadoEm: '2026-10-17T10:00:00.000Z',
    payload: { idCliente: 'id-novo', pecaId: 303, tipoAvariaId: 2, descricao: 'Não veio' },
    ...parcial,
  };
}

const exibir = (replica: AvariaDaReplica[], acoes: AvariaNaFila[]) =>
  montarAvariasExibidas({ replica, acoes, tipos: TIPOS, pedidos: PEDIDOS });

describe('montarAvariasExibidas', () => {
  it('a avaria da réplica traz os rótulos do próprio registro e o nome do tipo', () => {
    expect(exibir([daReplica({ parecer: 'Peça reposta' })], [])).toEqual([
      {
        chave: 'id-77',
        descricaoPeca: 'Porta de correr 2,10m',
        ambiente: 'Quarto casal',
        numeroPedido: 'PED-2026-0012',
        tipoAvaria: 'Peça danificada',
        status: StatusAvaria.EM_ANALISE,
        parecer: 'Peça reposta',
        criadoEm: '2026-10-16T14:20:00.000Z',
        aguardandoEnvio: false,
      },
    ]);
  });

  it('avaria ainda na fila aparece "aguardando envio", com peça, ambiente, pedido e tipo achados pelo id', () => {
    const [avaria] = exibir([], [naFila()]);

    expect(avaria).toEqual({
      chave: 'id-novo',
      descricaoPeca: 'Porta de correr 2,10m',
      ambiente: 'Quarto casal',
      numeroPedido: 'PED-2026-0012',
      tipoAvaria: 'Peça faltando',
      status: StatusAvaria.REPORTADA,
      parecer: null,
      criadoEm: '2026-10-17T10:00:00.000Z',
      aguardandoEnvio: true,
    });
  });

  it('já aceita pelo servidor e aguardando o pull: aparece na lista, sem o selo', () => {
    const [avaria] = exibir([], [naFila({ status: 'enviada' })]);

    expect(avaria.aguardandoEnvio).toBe(false);
    expect(avaria.status).toBe(StatusAvaria.REPORTADA);
  });

  it('quando o pull traz a avaria (mesmo idCliente) a da fila some: nunca há duas', () => {
    const resultado = exibir(
      [daReplica({ idCliente: 'id-novo', id: '90', criadoEm: '2026-10-17T10:00:05.000Z' })],
      [naFila({ status: 'enviada' })],
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].chave).toBe('id-novo');
    expect(resultado[0].aguardandoEnvio).toBe(false);
  });

  it('avaria da réplica sem idCliente (criada fora do app) não engole nada da fila', () => {
    const resultado = exibir([daReplica({ idCliente: null })], [naFila()]);

    expect(resultado).toHaveLength(2);
  });

  it('mais recente primeiro, misturando réplica e fila', () => {
    const resultado = exibir(
      [
        daReplica({ id: '1', idCliente: 'a', criadoEm: '2026-10-10T10:00:00.000Z' }),
        daReplica({ id: '2', idCliente: 'b', criadoEm: '2026-10-16T10:00:00.000Z' }),
      ],
      [naFila({ criadoEm: '2026-10-13T10:00:00.000Z' })],
    );

    expect(resultado.map((avaria) => avaria.criadoEm)).toEqual([
      '2026-10-16T10:00:00.000Z',
      '2026-10-13T10:00:00.000Z',
      '2026-10-10T10:00:00.000Z',
    ]);
  });

  it('peça que não está mais na réplica não derruba a lista: cai no rótulo genérico', () => {
    const [avaria] = exibir(
      [],
      [naFila({ payload: { idCliente: 'x', pecaId: 999, tipoAvariaId: 7, descricao: 'd' } })],
    );

    expect(avaria.descricaoPeca).toBe('Peça #999');
    expect(avaria.ambiente).toBe('');
    expect(avaria.numeroPedido).toBe('');
    expect(avaria.tipoAvaria).toBe('Problema na peça');
  });

  it('tipo desconhecido na réplica também cai no rótulo genérico', () => {
    const [avaria] = exibir([daReplica({ tipoAvariaId: 99 })], []);

    expect(avaria.tipoAvaria).toBe('Problema na peça');
  });
});
