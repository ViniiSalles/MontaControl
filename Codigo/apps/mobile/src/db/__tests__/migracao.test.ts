import { Database, appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { stepsForMigration } from '@nozbe/watermelondb/Schema/migrations/stepsForMigration';
import { syncPullFixture } from '@montacontrol/shared';
import { schema } from '../schema';
import { migrations } from '../migrations';
import { gravarPullNaReplica, modelClasses } from './apoio';
import { Jornada } from '../Jornada';
import { BancoHoras } from '../BancoHoras';
import { AcaoPendente } from '../AcaoPendente';
import { Pedido } from '../Pedido';
import { Notificacao } from '../Notificacao';

/**
 * Cópia congelada do schema v1 (o primeiro que foi para os aparelhos). NÃO
 * editar: é a "versão antiga" do teste de migração.
 */
const schemaV1 = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'jornadas',
      columns: [
        { name: 'remote_id', type: 'number', isOptional: true },
        { name: 'usuario_id', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'checkin_at', type: 'string', isOptional: true },
        { name: 'checkin_latitude', type: 'number', isOptional: true },
        { name: 'checkin_longitude', type: 'number', isOptional: true },
        { name: 'checkin_endereco', type: 'string', isOptional: true },
        { name: 'checkout_at', type: 'string', isOptional: true },
        { name: 'checkout_latitude', type: 'number', isOptional: true },
        { name: 'checkout_longitude', type: 'number', isOptional: true },
        { name: 'checkout_endereco', type: 'string', isOptional: true },
        { name: 'lancado_em_atraso', type: 'boolean' },
        { name: 'criado_em', type: 'string' },
        { name: 'id_cliente_checkin', type: 'string', isOptional: true },
        { name: 'id_cliente_checkout', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'banco_horas',
      columns: [
        { name: 'mes', type: 'number' },
        { name: 'ano', type: 'number' },
        { name: 'horas_trabalhadas', type: 'number' },
        { name: 'horas_previstas', type: 'number' },
        { name: 'saldo', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'acoes_pendentes',
      columns: [
        { name: 'tipo', type: 'string' },
        { name: 'id_cliente', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'criado_em', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'mensagem_descarte', type: 'string', isOptional: true },
      ],
    }),
  ],
});

/**
 * Cópia congelada do schema v2 (aparelhos que já tinham a réplica, antes da
 * v3 da #112). NÃO editar: é a "versão antiga" do teste de migração v2 → v3.
 */
const schemaV2 = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'jornadas',
      columns: [
        { name: 'remote_id', type: 'number', isOptional: true },
        { name: 'usuario_id', type: 'number' },
        { name: 'pedido_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'checkin_at', type: 'string', isOptional: true, isIndexed: true },
        { name: 'checkin_latitude', type: 'number', isOptional: true },
        { name: 'checkin_longitude', type: 'number', isOptional: true },
        { name: 'checkin_endereco', type: 'string', isOptional: true },
        { name: 'checkin_id_cliente', type: 'string', isOptional: true },
        { name: 'checkout_at', type: 'string', isOptional: true },
        { name: 'checkout_latitude', type: 'number', isOptional: true },
        { name: 'checkout_longitude', type: 'number', isOptional: true },
        { name: 'checkout_endereco', type: 'string', isOptional: true },
        { name: 'checkout_id_cliente', type: 'string', isOptional: true },
        { name: 'lancado_em_atraso', type: 'boolean' },
        { name: 'criado_em', type: 'string' },
        { name: 'id_cliente_checkin', type: 'string', isOptional: true },
        { name: 'id_cliente_checkout', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'banco_horas',
      columns: [
        { name: 'mes', type: 'number', isIndexed: true },
        { name: 'ano', type: 'number', isIndexed: true },
        { name: 'horas_trabalhadas', type: 'number' },
        { name: 'horas_previstas', type: 'number' },
        { name: 'saldo', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'pedidos',
      columns: [
        { name: 'numero_pedido', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'cliente_id', type: 'string' },
        { name: 'cliente_nome', type: 'string' },
        { name: 'cliente_endereco', type: 'string' },
        { name: 'cliente_cidade', type: 'string' },
        { name: 'cliente_estado', type: 'string' },
        { name: 'cliente_latitude', type: 'number' },
        { name: 'cliente_longitude', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'ambientes',
      columns: [
        { name: 'pedido_id', type: 'string', isIndexed: true },
        { name: 'nome', type: 'string' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'pecas',
      columns: [
        { name: 'ambiente_id', type: 'string', isIndexed: true },
        { name: 'codigo_barras', type: 'string', isOptional: true },
        { name: 'descricao', type: 'string' },
        { name: 'quantidade', type: 'number' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'tipos_avaria',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'descricao', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'avarias',
      columns: [
        { name: 'id_cliente', type: 'string', isOptional: true },
        { name: 'peca_id', type: 'string' },
        { name: 'peca_descricao', type: 'string' },
        { name: 'ambiente_nome', type: 'string' },
        { name: 'numero_pedido', type: 'string' },
        { name: 'tipo_avaria_id', type: 'string' },
        { name: 'descricao', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'analisada_em', type: 'string', isOptional: true },
        { name: 'parecer', type: 'string', isOptional: true },
        { name: 'criado_em', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'atestados',
      columns: [
        { name: 'id_cliente', type: 'string' },
        { name: 'data_inicio', type: 'string' },
        { name: 'data_fim', type: 'string' },
        { name: 'observacao', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'motivo_rejeicao', type: 'string', isOptional: true },
        { name: 'validado_em', type: 'string', isOptional: true },
        { name: 'criado_em', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'acoes_pendentes',
      columns: [
        { name: 'tipo', type: 'string' },
        { name: 'id_cliente', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'criado_em', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'mensagem_descarte', type: 'string', isOptional: true },
      ],
    }),
  ],
});

/**
 * Cópia congelada do schema v3 (aparelhos com a réplica sem notificações, antes
 * da v4). NÃO editar: é a "versão antiga" do teste de migração v3 → v4.
 */
const schemaV3 = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'jornadas',
      columns: [
        { name: 'usuario_id', type: 'number' },
        { name: 'pedido_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'checkin_at', type: 'string', isOptional: true, isIndexed: true },
        { name: 'checkin_latitude', type: 'number', isOptional: true },
        { name: 'checkin_longitude', type: 'number', isOptional: true },
        { name: 'checkin_endereco', type: 'string', isOptional: true },
        { name: 'checkin_id_cliente', type: 'string', isOptional: true },
        { name: 'checkout_at', type: 'string', isOptional: true },
        { name: 'checkout_latitude', type: 'number', isOptional: true },
        { name: 'checkout_longitude', type: 'number', isOptional: true },
        { name: 'checkout_endereco', type: 'string', isOptional: true },
        { name: 'checkout_id_cliente', type: 'string', isOptional: true },
        { name: 'lancado_em_atraso', type: 'boolean' },
        { name: 'criado_em', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'banco_horas',
      columns: [
        { name: 'mes', type: 'number', isIndexed: true },
        { name: 'ano', type: 'number', isIndexed: true },
        { name: 'horas_trabalhadas', type: 'number' },
        { name: 'horas_previstas', type: 'number' },
        { name: 'saldo', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'pedidos',
      columns: [
        { name: 'numero_pedido', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'cliente_id', type: 'string' },
        { name: 'cliente_nome', type: 'string' },
        { name: 'cliente_endereco', type: 'string' },
        { name: 'cliente_cidade', type: 'string' },
        { name: 'cliente_estado', type: 'string' },
        { name: 'cliente_latitude', type: 'number' },
        { name: 'cliente_longitude', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'ambientes',
      columns: [
        { name: 'pedido_id', type: 'string', isIndexed: true },
        { name: 'nome', type: 'string' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'pecas',
      columns: [
        { name: 'ambiente_id', type: 'string', isIndexed: true },
        { name: 'codigo_barras', type: 'string', isOptional: true },
        { name: 'descricao', type: 'string' },
        { name: 'quantidade', type: 'number' },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'tipos_avaria',
      columns: [
        { name: 'nome', type: 'string' },
        { name: 'descricao', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'avarias',
      columns: [
        { name: 'id_cliente', type: 'string', isOptional: true },
        { name: 'peca_id', type: 'string' },
        { name: 'peca_descricao', type: 'string' },
        { name: 'ambiente_nome', type: 'string' },
        { name: 'numero_pedido', type: 'string' },
        { name: 'tipo_avaria_id', type: 'string' },
        { name: 'descricao', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'analisada_em', type: 'string', isOptional: true },
        { name: 'parecer', type: 'string', isOptional: true },
        { name: 'criado_em', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'atestados',
      columns: [
        { name: 'id_cliente', type: 'string' },
        { name: 'data_inicio', type: 'string' },
        { name: 'data_fim', type: 'string' },
        { name: 'observacao', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'motivo_rejeicao', type: 'string', isOptional: true },
        { name: 'validado_em', type: 'string', isOptional: true },
        { name: 'criado_em', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'acoes_pendentes',
      columns: [
        { name: 'tipo', type: 'string' },
        { name: 'id_cliente', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'criado_em', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'mensagem_descarte', type: 'string', isOptional: true },
      ],
    }),
  ],
});

/** Models que existiam até a v3 (a tabela `notificacoes` só nasce na v4). */
const modelosAteAV3 = modelClasses.filter((modelo) => modelo !== Notificacao);

const TABELAS_NOVAS = ['pedidos', 'ambientes', 'pecas', 'tipos_avaria', 'avarias', 'atestados'];
const COLUNAS_FORA_NA_V3 = ['remote_id', 'id_cliente_checkin', 'id_cliente_checkout'];

/** Reabre o mesmo armazenamento em memória com outro schema — o app "atualizado". */
async function atualizarPara(adapter: LokiJSAdapter, opcoes: object): Promise<Database> {
  const novo = await (
    adapter as unknown as { testClone(opcoes: object): Promise<LokiJSAdapter> }
  ).testClone(opcoes);
  return new Database({ adapter: novo, modelClasses });
}

function criarAcaoPendente(banco: Database) {
  return banco.write(() =>
    banco.get<AcaoPendente>('acoes_pendentes').create((acao) => {
      acao.tipo = 'checkin';
      acao.idCliente = 'id-pendente-1';
      acao.payload = '{"latitude":-19.9}';
      acao.criadoEm = '2026-10-16T12:00:00.000Z';
      acao.status = 'pendente';
      acao.mensagemDescarte = null;
    }),
  );
}

describe('migrações do banco local', () => {
  it('o schema atual está na v4 e as migrações cobrem até a versão do schema', () => {
    expect(schema.version).toBe(4);
    expect(migrations.maxVersion).toBe(schema.version);
  });

  it('v1 → v2 cria as tabelas da réplica e acrescenta colunas em jornadas', () => {
    const passos = stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 });
    expect(passos).not.toBeNull();

    const criadas = passos!.flatMap((p) => (p.type === 'create_table' ? [p.schema.name] : []));
    expect(criadas.sort()).toEqual([...TABELAS_NOVAS].sort());

    const colunasNovas = passos!.flatMap((p) =>
      p.type === 'add_columns' && p.table === 'jornadas' ? p.columns.map((c) => c.name) : [],
    );
    expect(colunasNovas.sort()).toEqual(['checkin_id_cliente', 'checkout_id_cliente', 'pedido_id']);
  });

  it('as tabelas criadas pela migração v2 têm as mesmas colunas do schema atual', () => {
    const passos = stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })!;
    for (const passo of passos) {
      if (passo.type !== 'create_table') continue;
      expect(passo.schema.columns).toEqual(schema.tables[passo.schema.name].columns);
    }
  });

  it('v3: as colunas do estado otimista saem do schema de jornadas (e só elas)', () => {
    const colunasV2 = Object.keys(schemaV2.tables.jornadas.columns);
    const colunasV3 = Object.keys(schema.tables.jornadas.columns);

    expect(colunasV2.filter((nome) => !colunasV3.includes(nome)).sort()).toEqual(
      [...COLUNAS_FORA_NA_V3].sort(),
    );
    expect(colunasV3.filter((nome) => !colunasV2.includes(nome))).toEqual([]);
  });

  it('v2 → v3 só limpa a réplica antiga por SQL: sem recriar nem apagar a fila', () => {
    const passos = stepsForMigration({ migrations, fromVersion: 2, toVersion: 3 });
    expect(passos).not.toBeNull();

    // O WatermelonDB não remove coluna: a física de `remote_id` e afins fica órfã.
    expect(passos!.map((p) => p.type)).toEqual(['sql']);
    const { sql } = passos![0] as { type: 'sql'; sql: string };
    expect(sql).toContain('delete from "jornadas"');
    expect(sql).toContain('delete from "banco_horas"');
    // Dados pessoais legados (cliente da obra) guardados pelo app v2 no localStorage.
    expect(sql).toContain('delete from "local_storage" where "key" in');
    expect(sql).toContain("'obras_do_montador'");
    expect(sql).toContain("'obra_da_jornada_aberta'");
    expect(sql).not.toMatch(/acoes_pendentes|drop /i);
  });

  it('banco v1 real migra até a v4 preservando acoes_pendentes e aceitando o pull do contrato', async () => {
    const adapterV1 = new LokiJSAdapter({
      dbName: `migracao-${Math.random()}`,
      schema: schemaV1,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    const bancoV1 = new Database({ adapter: adapterV1, modelClasses: [Jornada, BancoHoras, AcaoPendente] });
    await criarAcaoPendente(bancoV1);

    const bancoAtual = await atualizarPara(adapterV1, { schema, migrations });

    const acoes = await bancoAtual.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(acoes).toHaveLength(1);
    expect(acoes[0].idCliente).toBe('id-pendente-1');
    expect(acoes[0].payload).toBe('{"latitude":-19.9}');
    expect(acoes[0].status).toBe('pendente');

    for (const tabela of TABELAS_NOVAS) {
      expect(await bancoAtual.get(tabela).query().fetchCount()).toBe(0);
    }

    await gravarPullNaReplica(bancoAtual, syncPullFixture);
    expect(await bancoAtual.get<Pedido>('pedidos').query().fetchCount()).toBe(
      syncPullFixture.changes.pedidos.updated.length,
    );
    expect(await bancoAtual.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(1);
  });

  it('banco v2 real migra até a v4 preservando a ação pendente (check-in na fila)', async () => {
    const adapterV2 = new LokiJSAdapter({
      dbName: `migracao-v2-${Math.random()}`,
      schema: schemaV2,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    const bancoV2 = new Database({ adapter: adapterV2, modelClasses: modelosAteAV3 });
    await criarAcaoPendente(bancoV2);
    await bancoV2.write(() =>
      bancoV2.get<Jornada>('jornadas').create((jornada) => {
        jornada._setRaw('remote_id', 9);
        jornada.usuarioId = 7;
        jornada.status = 'EM_ANDAMENTO';
        jornada.checkinAt = '2026-10-16T11:00:03.000Z';
        jornada.lancadoEmAtraso = false;
        jornada.criadoEm = '2026-10-16T11:00:03.000Z';
        jornada._setRaw('id_cliente_checkin', 'id-pendente-1');
      }),
    );

    // O banco migra pelas migrações reais, passo a passo, até o schema atual.
    const bancoV4 = await atualizarPara(adapterV2, { schema, migrations });

    const acoes = await bancoV4.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(acoes).toHaveLength(1);
    expect(acoes[0].tipo).toBe('checkin');
    expect(acoes[0].idCliente).toBe('id-pendente-1');
    expect(acoes[0].payload).toBe('{"latitude":-19.9}');
    expect(acoes[0].status).toBe('pendente');

    // O banco migrado aceita o pull do contrato (que não conhece `remote_id`).
    await gravarPullNaReplica(bancoV4, syncPullFixture);
    expect(await bancoV4.get<Jornada>('jornadas').find('502')).toBeDefined();
    expect(await bancoV4.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(1);
  });

  it('v3 → v4 só cria a tabela notificacoes, com as colunas do schema atual', () => {
    const passos = stepsForMigration({ migrations, fromVersion: 3, toVersion: 4 });
    expect(passos).not.toBeNull();

    expect(passos!.map((p) => p.type)).toEqual(['create_table']);
    const [passo] = passos!;
    if (passo.type !== 'create_table') throw new Error('passo inesperado');
    expect(passo.schema.name).toBe('notificacoes');
    expect(passo.schema.columns).toEqual(schema.tables.notificacoes.columns);
    expect(Object.keys(schemaV3.tables)).not.toContain('notificacoes');
  });

  it('banco v3 real migra para v4 criando notificacoes sem perder a fila nem a réplica', async () => {
    const adapterV3 = new LokiJSAdapter({
      dbName: `migracao-v3-${Math.random()}`,
      schema: schemaV3,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    const bancoV3 = new Database({
      adapter: adapterV3,
      modelClasses: modelosAteAV3,
    });
    await criarAcaoPendente(bancoV3);
    await bancoV3.write(() =>
      bancoV3.get<Pedido>('pedidos').create((pedido) => {
        pedido._raw.id = '10';
        pedido.numeroPedido = 'PED-000010';
        pedido.status = 'EM_ENTREGA';
        pedido.clienteId = '3';
        pedido.clienteNome = 'Maria Souza';
        pedido.clienteEndereco = 'Av. Afonso Pena, 1000';
        pedido.clienteCidade = 'Belo Horizonte';
        pedido.clienteEstado = 'MG';
        pedido.clienteLatitude = -19.9325;
        pedido.clienteLongitude = -43.9382;
      }),
    );

    const bancoV4 = await atualizarPara(adapterV3, { schema, migrations });

    const acoes = await bancoV4.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(acoes).toHaveLength(1);
    expect(acoes[0].idCliente).toBe('id-pendente-1');
    expect(await bancoV4.get<Pedido>('pedidos').find('10')).toBeDefined();

    expect(await bancoV4.get<Notificacao>('notificacoes').query().fetchCount()).toBe(0);
    await gravarPullNaReplica(bancoV4, syncPullFixture);
    expect(await bancoV4.get<Notificacao>('notificacoes').query().fetchCount()).toBe(
      syncPullFixture.changes.notificacoes.updated.length,
    );
    expect(await bancoV4.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(1);
  });
});
