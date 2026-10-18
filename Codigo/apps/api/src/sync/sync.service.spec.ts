import { Test } from '@nestjs/testing';
import {
  StatusAmbiente,
  StatusAtestado,
  StatusAvaria,
  StatusJornada,
  StatusPeca,
  StatusPedido,
  SYNC_JANELA_ATESTADOS_DIAS,
  SYNC_JANELA_AVARIAS_DIAS,
  SYNC_JANELA_JORNADAS_DIAS,
  SYNC_SCHEMA_VERSION,
  TABELAS_SYNC,
} from '@montacontrol/shared';
import { AmbientesRepository } from '../ambientes/ambientes.repository';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { AvariasRepository } from '../avarias/avarias.repository';
import { TiposAvariaRepository } from '../avarias/tipos-avaria.repository';
import { BancoHorasRepository } from '../banco-horas/banco-horas.repository';
import { BancoHorasService } from '../banco-horas/banco-horas.service';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PecasRepository } from '../pecas/pecas.repository';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { SyncExclusaoRepository } from './sync-exclusao.repository';
import { SyncService, SYNC_MARGEM_SEGURANCA_MS } from './sync.service';
import { VersaoSchemaIncompativelException } from './exceptions/versao-schema-incompativel.exception';

const DIA_MS = 24 * 60 * 60 * 1000;
// 17/10/2026 15:00 em São Paulo (UTC-3); o fuso importa para a janela do banco de horas.
const AGORA = Date.parse('2026-10-17T18:00:00.000Z');
const USUARIO_ID = 7;

describe('SyncService', () => {
  let service: SyncService;
  let jornadas: { listarParaSync: jest.Mock };
  let bancoHoras: { listarParaSync: jest.Mock };
  let bancoHorasService: { atualizarMesCorrenteSeMudou: jest.Mock };
  let pedidos: { listarParaSync: jest.Mock };
  let ambientes: { listarParaSync: jest.Mock };
  let pecas: { listarParaSync: jest.Mock };
  let tiposAvaria: { listarParaSync: jest.Mock };
  let avarias: { listarParaSync: jest.Mock };
  let atestados: { listarParaSync: jest.Mock };
  let exclusoes: { listarDesde: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(AGORA);
    jornadas = { listarParaSync: jest.fn().mockResolvedValue([]) };
    bancoHoras = { listarParaSync: jest.fn().mockResolvedValue([]) };
    bancoHorasService = { atualizarMesCorrenteSeMudou: jest.fn().mockResolvedValue(undefined) };
    pedidos = { listarParaSync: jest.fn().mockResolvedValue([]) };
    ambientes = { listarParaSync: jest.fn().mockResolvedValue([]) };
    pecas = { listarParaSync: jest.fn().mockResolvedValue([]) };
    tiposAvaria = { listarParaSync: jest.fn().mockResolvedValue([]) };
    avarias = { listarParaSync: jest.fn().mockResolvedValue([]) };
    atestados = { listarParaSync: jest.fn().mockResolvedValue([]) };
    exclusoes = { listarDesde: jest.fn().mockResolvedValue([]) };

    const modulo = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: JornadasRepository, useValue: jornadas },
        { provide: BancoHorasRepository, useValue: bancoHoras },
        { provide: BancoHorasService, useValue: bancoHorasService },
        { provide: PedidosRepository, useValue: pedidos },
        { provide: AmbientesRepository, useValue: ambientes },
        { provide: PecasRepository, useValue: pecas },
        { provide: TiposAvariaRepository, useValue: tiposAvaria },
        { provide: AvariasRepository, useValue: avarias },
        { provide: AtestadosRepository, useValue: atestados },
        { provide: SyncExclusaoRepository, useValue: exclusoes },
      ],
    }).compile();
    service = modulo.get(SyncService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('verificarVersaoSchema', () => {
    it('aceita a versão do contrato', () => {
      expect(() => service.verificarVersaoSchema(SYNC_SCHEMA_VERSION)).not.toThrow();
    });

    it.each([SYNC_SCHEMA_VERSION - 1, SYNC_SCHEMA_VERSION + 1, 0])(
      'recusa a versão %i com código próprio',
      (versao) => {
        expect.assertions(2);
        try {
          service.verificarVersaoSchema(versao);
        } catch (erro) {
          expect(erro).toBeInstanceOf(VersaoSchemaIncompativelException);
          expect((erro as VersaoSchemaIncompativelException).codigo).toBe(
            'VERSAO_SCHEMA_INCOMPATIVEL',
          );
        }
      },
    );
  });

  describe('primeiro pull (sem lastPulledAt)', () => {
    it('aplica as janelas do contrato e não filtra por data de alteração', async () => {
      await service.pull(USUARIO_ID);

      expect(jornadas.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        new Date(AGORA - SYNC_JANELA_JORNADAS_DIAS * DIA_MS),
        undefined,
      );
      expect(avarias.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        new Date(AGORA - SYNC_JANELA_AVARIAS_DIAS * DIA_MS),
        undefined,
      );
      expect(atestados.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        new Date(AGORA - SYNC_JANELA_ATESTADOS_DIAS * DIA_MS),
        undefined,
      );
      // Outubro/2026 no fuso de operação: mês atual + 2 anteriores = a partir de agosto.
      expect(bancoHoras.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        { ano: 2026, mes: 8 },
        undefined,
      );
      expect(pedidos.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined);
      expect(ambientes.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined);
      expect(pecas.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined);
      expect(tiposAvaria.listarParaSync).toHaveBeenCalledWith(undefined);
    });

    it('janela do banco de horas atravessa a virada do ano (janeiro vê novembro e dezembro)', async () => {
      // 05/01/2027 09:00 em São Paulo.
      jest.setSystemTime(Date.parse('2027-01-05T12:00:00.000Z'));

      await service.pull(USUARIO_ID);

      expect(bancoHoras.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        { ano: 2026, mes: 11 },
        undefined,
      );
    });

    it('o mês do banco de horas é o do fuso de operação, não o de UTC', async () => {
      // 01/11/2026 00:30 UTC ainda é 31/10 em São Paulo.
      jest.setSystemTime(Date.parse('2026-11-01T00:30:00.000Z'));

      await service.pull(USUARIO_ID);

      expect(bancoHoras.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        { ano: 2026, mes: 8 },
        undefined,
      );
    });

    it('não consulta exclusões e devolve todas as tabelas com created vazio', async () => {
      const resposta = await service.pull(USUARIO_ID);

      expect(exclusoes.listarDesde).not.toHaveBeenCalled();
      expect(Object.keys(resposta.changes).sort()).toEqual([...TABELAS_SYNC].sort());
      for (const tabela of TABELAS_SYNC) {
        expect(resposta.changes[tabela]).toEqual({ created: [], updated: [], deleted: [] });
      }
      expect(resposta.timestamp).toBe(AGORA);
    });

    it('lastPulledAt = 0 é tratado como primeiro pull', async () => {
      await service.pull(USUARIO_ID, 0);

      expect(exclusoes.listarDesde).not.toHaveBeenCalled();
      expect(tiposAvaria.listarParaSync).toHaveBeenCalledWith(undefined);
    });
  });

  describe('pull incremental (com lastPulledAt)', () => {
    const ultimoPull = AGORA - 60 * 60 * 1000;
    const desdeEsperado = new Date(ultimoPull - SYNC_MARGEM_SEGURANCA_MS);

    it('filtra por alteração posterior a lastPulledAt menos a margem de segurança', async () => {
      await service.pull(USUARIO_ID, ultimoPull);

      expect(pedidos.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, desdeEsperado);
      expect(ambientes.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, desdeEsperado);
      expect(pecas.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, desdeEsperado);
      expect(tiposAvaria.listarParaSync).toHaveBeenCalledWith(desdeEsperado);
      expect(exclusoes.listarDesde).toHaveBeenCalledWith(USUARIO_ID, desdeEsperado);
    });

    it('a margem de segurança é de 5 minutos', () => {
      expect(SYNC_MARGEM_SEGURANCA_MS).toBe(5 * 60 * 1000);
    });

    it('não aplica as janelas de histórico: só o filtro de alteração', async () => {
      await service.pull(USUARIO_ID, ultimoPull);

      // Uma avaria criada fora da janela e analisada agora precisa chegar ao aparelho.
      expect(jornadas.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined, desdeEsperado);
      expect(avarias.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined, desdeEsperado);
      expect(atestados.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined, desdeEsperado);
      expect(bancoHoras.listarParaSync).toHaveBeenCalledWith(USUARIO_ID, undefined, desdeEsperado);
    });

    it('manda as linhas alteradas em updated, com created vazio', async () => {
      jornadas.listarParaSync.mockResolvedValue([
        {
          id: 501,
          usuarioId: USUARIO_ID,
          pedidoId: 12,
          status: StatusJornada.FINALIZADA,
          checkinAt: new Date('2026-10-15T11:02:10.000Z'),
          checkinLatitude: -19.9191234,
          checkinLongitude: -43.9386123,
          checkinEndereco: 'Rua das Acácias, 120',
          checkinIdCliente: 'uuid-1',
          checkoutAt: null,
          checkoutLatitude: null,
          checkoutLongitude: null,
          checkoutEndereco: null,
          checkoutIdCliente: null,
          lancadoEmAtraso: true,
          criadoEm: new Date('2026-10-15T11:02:11.000Z'),
        },
      ]);

      const resposta = await service.pull(USUARIO_ID, ultimoPull);

      expect(resposta.changes.jornadas.created).toEqual([]);
      expect(resposta.changes.jornadas.updated).toEqual([
        {
          id: '501',
          usuario_id: USUARIO_ID,
          pedido_id: '12',
          status: StatusJornada.FINALIZADA,
          checkin_at: '2026-10-15T11:02:10.000Z',
          checkin_latitude: -19.9191234,
          checkin_longitude: -43.9386123,
          checkin_endereco: 'Rua das Acácias, 120',
          checkin_id_cliente: 'uuid-1',
          checkout_at: null,
          checkout_latitude: null,
          checkout_longitude: null,
          checkout_endereco: null,
          checkout_id_cliente: null,
          lancado_em_atraso: true,
          criado_em: '2026-10-15T11:02:11.000Z',
        },
      ]);
    });
  });

  describe('saldo do mês corrente', () => {
    it('recalcula o mês corrente só do usuário logado, antes de ler o banco de horas', async () => {
      const ordem: string[] = [];
      bancoHorasService.atualizarMesCorrenteSeMudou.mockImplementation(async () => {
        ordem.push('recalculo');
      });
      bancoHoras.listarParaSync.mockImplementation(async () => {
        ordem.push('leitura');
        return [];
      });

      await service.pull(USUARIO_ID);

      expect(bancoHorasService.atualizarMesCorrenteSeMudou).toHaveBeenCalledTimes(1);
      expect(bancoHorasService.atualizarMesCorrenteSeMudou).toHaveBeenCalledWith(USUARIO_ID);
      expect(ordem).toEqual(['recalculo', 'leitura']);
    });

    it('recalcula também no pull incremental', async () => {
      await service.pull(USUARIO_ID, AGORA - 60 * 60 * 1000);

      expect(bancoHorasService.atualizarMesCorrenteSeMudou).toHaveBeenCalledWith(USUARIO_ID);
    });

    it('cada pull recalcula só o usuário que puxou', async () => {
      await service.pull(USUARIO_ID);
      await service.pull(USUARIO_ID + 1);

      expect(bancoHorasService.atualizarMesCorrenteSeMudou.mock.calls).toEqual([
        [USUARIO_ID],
        [USUARIO_ID + 1],
      ]);
    });

    it('falha no recálculo não derruba o pull: segue com as linhas gravadas', async () => {
      bancoHorasService.atualizarMesCorrenteSeMudou.mockRejectedValue(new Error('banco fora'));
      bancoHoras.listarParaSync.mockResolvedValue([
        { id: 31, mes: 10, ano: 2026, horasTrabalhadas: 72.25, horasPrevistas: 88, saldo: -15.75 },
      ]);

      const resposta = await service.pull(USUARIO_ID);

      expect(resposta.changes.banco_horas.updated).toHaveLength(1);
      expect(resposta.timestamp).toBe(AGORA);
    });

    it('o timestamp continua sendo lido antes do recálculo', async () => {
      bancoHorasService.atualizarMesCorrenteSeMudou.mockImplementation(async () => {
        jest.setSystemTime(Date.now() + 5000);
      });

      const resposta = await service.pull(USUARIO_ID);

      expect(resposta.timestamp).toBe(AGORA);
    });
  });

  describe('mapeamento das linhas', () => {
    it('converte cada tabela para snake_case com ids em string', async () => {
      bancoHoras.listarParaSync.mockResolvedValue([
        { id: 31, mes: 10, ano: 2026, horasTrabalhadas: 72.25, horasPrevistas: 88, saldo: -15.75 },
      ]);
      pedidos.listarParaSync.mockResolvedValue([
        {
          id: 12,
          numeroPedido: 'PED-000012',
          status: StatusPedido.EM_ENTREGA,
          clienteId: 3,
          clienteNome: 'Residencial Acácias',
          clienteEndereco: 'Rua das Acácias, 120',
          clienteCidade: 'Belo Horizonte',
          clienteEstado: 'MG',
          clienteLatitude: -19.9,
          clienteLongitude: -43.9,
        },
      ]);
      ambientes.listarParaSync.mockResolvedValue([
        { id: 30, pedidoId: 12, nome: 'Cozinha', status: StatusAmbiente.COMPLETO },
      ]);
      pecas.listarParaSync.mockResolvedValue([
        {
          id: 301,
          ambienteId: 30,
          codigoBarras: null,
          descricao: 'Armário aéreo',
          quantidade: 2,
          status: StatusPeca.PENDENTE,
        },
      ]);
      tiposAvaria.listarParaSync.mockResolvedValue([
        { id: 1, nome: 'Dano', descricao: 'Dano de transporte.' },
      ]);
      avarias.listarParaSync.mockResolvedValue([
        {
          id: 77,
          idCliente: null,
          pecaId: 301,
          pecaDescricao: 'Armário aéreo',
          ambienteNome: 'Cozinha',
          numeroPedido: 'PED-000012',
          tipoAvariaId: 1,
          descricao: 'Lascado.',
          status: StatusAvaria.EM_ANALISE,
          analisadaEm: new Date('2026-10-16T15:00:00.000Z'),
          parecer: 'Em análise.',
          criadoEm: new Date('2026-10-16T14:20:00.000Z'),
        },
      ]);
      atestados.listarParaSync.mockResolvedValue([
        {
          id: 9,
          idCliente: 'uuid-9',
          dataInicio: new Date('2026-09-22T00:00:00.000Z'),
          dataFim: new Date('2026-09-23T00:00:00.000Z'),
          observacao: null,
          status: StatusAtestado.REJEITADO,
          motivoRejeicao: 'Ilegível.',
          validadoEm: new Date('2026-09-25T13:00:00.000Z'),
          criadoEm: new Date('2026-09-24T12:00:00.000Z'),
        },
      ]);

      const { changes } = await service.pull(USUARIO_ID);

      expect(changes.banco_horas.updated).toEqual([
        {
          id: '31',
          mes: 10,
          ano: 2026,
          horas_trabalhadas: 72.25,
          horas_previstas: 88,
          saldo: -15.75,
        },
      ]);
      expect(changes.pedidos.updated).toEqual([
        {
          id: '12',
          numero_pedido: 'PED-000012',
          status: StatusPedido.EM_ENTREGA,
          cliente_id: '3',
          cliente_nome: 'Residencial Acácias',
          cliente_endereco: 'Rua das Acácias, 120',
          cliente_cidade: 'Belo Horizonte',
          cliente_estado: 'MG',
          cliente_latitude: -19.9,
          cliente_longitude: -43.9,
        },
      ]);
      expect(changes.ambientes.updated).toEqual([
        { id: '30', pedido_id: '12', nome: 'Cozinha', status: StatusAmbiente.COMPLETO },
      ]);
      expect(changes.pecas.updated).toEqual([
        {
          id: '301',
          ambiente_id: '30',
          codigo_barras: null,
          descricao: 'Armário aéreo',
          quantidade: 2,
          status: StatusPeca.PENDENTE,
        },
      ]);
      expect(changes.tipos_avaria.updated).toEqual([
        { id: '1', nome: 'Dano', descricao: 'Dano de transporte.' },
      ]);
      expect(changes.avarias.updated).toEqual([
        {
          id: '77',
          id_cliente: null,
          peca_id: '301',
          peca_descricao: 'Armário aéreo',
          ambiente_nome: 'Cozinha',
          numero_pedido: 'PED-000012',
          tipo_avaria_id: '1',
          descricao: 'Lascado.',
          status: StatusAvaria.EM_ANALISE,
          analisada_em: '2026-10-16T15:00:00.000Z',
          parecer: 'Em análise.',
          criado_em: '2026-10-16T14:20:00.000Z',
        },
      ]);
      expect(changes.atestados.updated).toEqual([
        {
          id: '9',
          id_cliente: 'uuid-9',
          data_inicio: '2026-09-22',
          data_fim: '2026-09-23',
          observacao: null,
          status: StatusAtestado.REJEITADO,
          motivo_rejeicao: 'Ilegível.',
          validado_em: '2026-09-25T13:00:00.000Z',
          criado_em: '2026-09-24T12:00:00.000Z',
        },
      ]);
    });
  });

  describe('exclusões', () => {
    const ultimoPull = AGORA - 60 * 60 * 1000;

    it('agrupa os ids excluídos por tabela', async () => {
      exclusoes.listarDesde.mockResolvedValue([
        { entidade: 'pedidos', registroId: '41' },
        { entidade: 'ambientes', registroId: '150' },
        { entidade: 'ambientes', registroId: '151' },
        { entidade: 'pecas', registroId: '900' },
      ]);

      const { changes } = await service.pull(USUARIO_ID, ultimoPull);

      expect(changes.pedidos.deleted).toEqual(['41']);
      expect(changes.ambientes.deleted).toEqual(['150', '151']);
      expect(changes.pecas.deleted).toEqual(['900']);
      expect(changes.jornadas.deleted).toEqual([]);
    });

    it('desalocação repetida do mesmo registro vai uma única vez', async () => {
      exclusoes.listarDesde.mockResolvedValue([
        { entidade: 'pedidos', registroId: '41' },
        { entidade: 'pedidos', registroId: '41' },
      ]);

      const { changes } = await service.pull(USUARIO_ID, ultimoPull);

      expect(changes.pedidos.deleted).toEqual(['41']);
    });

    it('reatribuição: id excluído que também está em updated sai de deleted', async () => {
      exclusoes.listarDesde.mockResolvedValue([
        { entidade: 'pedidos', registroId: '12' },
        { entidade: 'pedidos', registroId: '41' },
        { entidade: 'ambientes', registroId: '30' },
        { entidade: 'pecas', registroId: '301' },
      ]);
      pedidos.listarParaSync.mockResolvedValue([
        {
          id: 12,
          numeroPedido: 'PED-000012',
          status: StatusPedido.AGUARDANDO,
          clienteId: 3,
          clienteNome: 'C',
          clienteEndereco: 'E',
          clienteCidade: 'BH',
          clienteEstado: 'MG',
          clienteLatitude: 0,
          clienteLongitude: 0,
        },
      ]);
      ambientes.listarParaSync.mockResolvedValue([
        { id: 30, pedidoId: 12, nome: 'Cozinha', status: StatusAmbiente.PENDENTE },
      ]);
      pecas.listarParaSync.mockResolvedValue([
        {
          id: 301,
          ambienteId: 30,
          codigoBarras: null,
          descricao: 'P',
          quantidade: 1,
          status: StatusPeca.PENDENTE,
        },
      ]);

      const { changes } = await service.pull(USUARIO_ID, ultimoPull);

      expect(changes.pedidos.updated.map((linha) => linha.id)).toEqual(['12']);
      expect(changes.pedidos.deleted).toEqual(['41']);
      expect(changes.ambientes.deleted).toEqual([]);
      expect(changes.pecas.deleted).toEqual([]);
    });

    it('só o id igual na mesma tabela é descartado (ids de tabelas diferentes podem coincidir)', async () => {
      exclusoes.listarDesde.mockResolvedValue([{ entidade: 'ambientes', registroId: '12' }]);
      pedidos.listarParaSync.mockResolvedValue([
        {
          id: 12,
          numeroPedido: 'PED-000012',
          status: StatusPedido.AGUARDANDO,
          clienteId: 3,
          clienteNome: 'C',
          clienteEndereco: 'E',
          clienteCidade: 'BH',
          clienteEstado: 'MG',
          clienteLatitude: 0,
          clienteLongitude: 0,
        },
      ]);

      const { changes } = await service.pull(USUARIO_ID, ultimoPull);

      expect(changes.ambientes.deleted).toEqual(['12']);
    });
  });

  describe('timestamp', () => {
    it('é o relógio do servidor capturado antes de qualquer consulta', async () => {
      // Cada consulta "demora": o relógio anda 2 s a cada chamada ao banco.
      const demorar = (resultado: unknown) => async () => {
        jest.setSystemTime(Date.now() + 2000);
        return resultado;
      };
      jornadas.listarParaSync.mockImplementation(demorar([]));
      pedidos.listarParaSync.mockImplementation(demorar([]));
      avarias.listarParaSync.mockImplementation(demorar([]));
      exclusoes.listarDesde.mockImplementation(demorar([]));

      const resposta = await service.pull(USUARIO_ID, AGORA - 1000);

      expect(resposta.timestamp).toBe(AGORA);
      expect(Date.now()).toBeGreaterThan(AGORA);
    });

    it('as janelas e o filtro partem do mesmo instante do timestamp', async () => {
      jornadas.listarParaSync.mockImplementation(async () => {
        jest.setSystemTime(Date.now() + 10_000);
        return [];
      });
      atestados.listarParaSync.mockImplementation(async () => {
        jest.setSystemTime(Date.now() + 10_000);
        return [];
      });

      await service.pull(USUARIO_ID);

      expect(atestados.listarParaSync).toHaveBeenCalledWith(
        USUARIO_ID,
        new Date(AGORA - SYNC_JANELA_ATESTADOS_DIAS * DIA_MS),
        undefined,
      );
    });
  });
});
