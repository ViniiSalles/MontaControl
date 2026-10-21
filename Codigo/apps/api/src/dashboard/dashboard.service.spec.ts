import { Test } from '@nestjs/testing';
import { StatusPedido as StatusPedidoCompartilhado } from '@montacontrol/shared';
import { StatusPeca } from '../../generated/prisma';
import { DashboardRepository } from './dashboard.repository';
import type { EventosRecentes, PedidoParaAcompanhamento } from './dashboard.repository';
import {
  DashboardService,
  etapaDoPedido,
  montarAcompanhamento,
  montarAlertas,
  montarProdutividade,
} from './dashboard.service';

const SEM_EVENTOS: EventosRecentes = {
  checkins: [],
  checkouts: [],
  avarias: [],
  triagens: [],
  descarregamentos: [],
  inconsistencias: [],
};

function peca(status: StatusPeca, extras: Partial<PedidoParaAcompanhamento['pecas'][number]> = {}) {
  return { status, triadaAt: null, conferidaAt: null, avariasAbertas: 0, ...extras };
}

function pedido(pecas: PedidoParaAcompanhamento['pecas']): PedidoParaAcompanhamento {
  return {
    id: 1,
    numeroPedido: 'PED-1',
    status: StatusPedidoCompartilhado.EM_ENTREGA,
    cliente: { nome: 'Ana', cidade: 'BH', estado: 'MG' },
    montadores: ['João'],
    pecas,
  };
}

describe('etapaDoPedido', () => {
  it.each([
    [0, 0, 0, 'AGUARDANDO_FABRICA'],
    [5, 0, 0, 'AGUARDANDO_FABRICA'],
    [5, 2, 0, 'EM_TRIAGEM'],
    [5, 5, 0, 'NO_ESTOQUE'],
    [5, 5, 3, 'EM_DESCARREGAMENTO'],
    [5, 5, 5, 'NO_CLIENTE'],
  ])('total %i, estoque %i, cliente %i → %s', (total, estoque, cliente, etapa) => {
    expect(etapaDoPedido(total, estoque, cliente)).toBe(etapa);
  });
});

describe('montarAcompanhamento', () => {
  it('conta estoque (tudo que saiu de PENDENTE), cliente, inconsistências e avarias', () => {
    const triada = new Date('2026-10-19T12:00:00Z');
    const conferida = new Date('2026-10-20T15:00:00Z');
    const resultado = montarAcompanhamento(
      pedido([
        peca(StatusPeca.PENDENTE),
        peca(StatusPeca.TRIADA, { triadaAt: triada, avariasAbertas: 2 }),
        peca(StatusPeca.DESCARREGADA, { triadaAt: triada, conferidaAt: conferida }),
        peca(StatusPeca.INCONSISTENTE, { triadaAt: triada }),
      ]),
    );

    expect(resultado).toMatchObject({
      etapa: 'EM_DESCARREGAMENTO',
      totalPecas: 4,
      pecasNoEstoque: 3,
      pecasNoCliente: 1,
      pecasInconsistentes: 1,
      avariasAbertas: 2,
      ultimaTriagemEm: triada.toISOString(),
      ultimoDescarregamentoEm: conferida.toISOString(),
    });
  });
});

describe('montarAlertas', () => {
  it('agrupa bipagens por pedido e ordena do mais recente para o mais antigo', () => {
    const alertas = montarAlertas({
      ...SEM_EVENTOS,
      descarregamentos: [
        {
          pedidoId: 1,
          numeroPedido: 'PED-1',
          responsavel: 'João',
          em: new Date('2026-10-20T10:00:00Z'),
        },
        {
          pedidoId: 1,
          numeroPedido: 'PED-1',
          responsavel: 'João',
          em: new Date('2026-10-20T10:05:00Z'),
        },
      ],
      checkins: [
        {
          jornadaId: 7,
          montador: 'Maria',
          numeroPedido: null,
          em: new Date('2026-10-20T09:00:00Z'),
        },
      ],
      avarias: [
        {
          avariaId: 3,
          montador: 'João',
          pecaDescricao: 'Porta',
          tipo: 'Risco',
          numeroPedido: 'PED-1',
          em: new Date('2026-10-20T11:00:00Z'),
        },
      ],
    });

    expect(alertas.map((alerta) => alerta.id)).toEqual([
      'avaria-3',
      `descarregamento-1-${Date.parse('2026-10-20T10:00:00Z')}`,
      'checkin-7',
    ]);
    expect(alertas[1]).toMatchObject({
      tipo: 'DESCARREGAMENTO',
      descricao: 'Pedido PED-1: 2 peças conferida(s) na obra por João.',
      em: '2026-10-20T10:05:00.000Z',
    });
  });

  it('separa em levas as bipagens do mesmo pedido com pausa maior que 1 h', () => {
    const alertas = montarAlertas({
      ...SEM_EVENTOS,
      triagens: [
        {
          pedidoId: 1,
          numeroPedido: 'PED-1',
          responsavel: 'Ana',
          em: new Date('2026-10-12T04:00:00Z'),
        },
        {
          pedidoId: 1,
          numeroPedido: 'PED-1',
          responsavel: 'Ana',
          em: new Date('2026-10-20T09:00:00Z'),
        },
        {
          pedidoId: 1,
          numeroPedido: 'PED-1',
          responsavel: 'Bia',
          em: new Date('2026-10-20T09:40:00Z'),
        },
      ],
    });

    expect(alertas.map((alerta) => [alerta.descricao, alerta.em])).toEqual([
      ['Pedido PED-1: 2 peças bipada(s) na triagem por Ana, Bia.', '2026-10-20T09:40:00.000Z'],
      ['Pedido PED-1: 1 peça bipada(s) na triagem por Ana.', '2026-10-12T04:00:00.000Z'],
    ]);
  });
});

describe('montarProdutividade', () => {
  it('distribui por dia civil de São Paulo, não por dia UTC', () => {
    // 01:00 UTC de 20/10 ainda é 19/10 às 22h em São Paulo.
    const dias = montarProdutividade(
      '2026-10-20',
      [new Date('2026-10-20T01:00:00Z')],
      [new Date('2026-10-20T15:00:00Z'), new Date('2026-10-20T16:00:00Z')],
    );

    expect(dias).toHaveLength(7);
    expect(dias[0].dia).toBe('2026-10-14');
    expect(dias[5]).toEqual({ dia: '2026-10-19', pecasTriadas: 1, pecasDescarregadas: 0 });
    expect(dias[6]).toEqual({ dia: '2026-10-20', pecasTriadas: 0, pecasDescarregadas: 2 });
  });
});

describe('DashboardService', () => {
  it('N2T1: monta indicadores, pedidos, alertas e produtividade com "hoje" no fuso da operação', async () => {
    const repositorio = {
      listarPedidosParaAcompanhamento: jest
        .fn()
        .mockResolvedValue([pedido([peca(StatusPeca.TRIADA)])]),
      contarMontadoresEmCampo: jest.fn().mockResolvedValue(3),
      contarAvariasDesde: jest.fn().mockResolvedValue(1),
      contarAvariasAbertas: jest.fn().mockResolvedValue(4),
      contarPecasInconsistentes: jest.fn().mockResolvedValue(2),
      contarEpisVencendoAte: jest.fn().mockResolvedValue(5),
      listarInstantesDeTriagemDesde: jest
        .fn()
        .mockResolvedValue([new Date('2026-10-20T13:00:00Z')]),
      listarInstantesDeDescarregamentoDesde: jest.fn().mockResolvedValue([]),
      listarEventosRecentes: jest.fn().mockResolvedValue(SEM_EVENTOS),
    };
    const modulo = await Test.createTestingModule({
      providers: [DashboardService, DashboardRepository],
    })
      .overrideProvider(DashboardRepository)
      .useValue(repositorio)
      .compile();
    const service = modulo.get(DashboardService);

    const agora = new Date('2026-10-20T15:00:00Z');
    const dashboard = await service.obter(agora);

    // Meia-noite de 20/10 em São Paulo (UTC-3).
    expect(repositorio.contarMontadoresEmCampo).toHaveBeenCalledWith(
      new Date('2026-10-20T03:00:00Z'),
    );
    expect(repositorio.listarEventosRecentes).toHaveBeenCalledWith(30, 500);
    expect(dashboard.indicadores).toEqual({
      montadoresEmCampo: 3,
      avariasHoje: 1,
      avariasAbertas: 4,
      pecasTriadasHoje: 1,
      pecasDescarregadasHoje: 0,
      pecasInconsistentes: 2,
      episVencendo: 5,
    });
    expect(dashboard.pedidos[0].etapa).toBe('NO_ESTOQUE');
    expect(dashboard.geradoEm).toBe(agora.toISOString());
  });
});
