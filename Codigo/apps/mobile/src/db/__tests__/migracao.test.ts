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

/**
 * Cópia congelada do schema v1 (o que está nos aparelhos hoje). NÃO editar:
 * é a "versão antiga" do teste de migração.
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

const TABELAS_NOVAS = ['pedidos', 'ambientes', 'pecas', 'tipos_avaria', 'avarias', 'atestados'];

describe('migrações do banco local', () => {
  it('o schema atual está na v2 e as migrações cobrem até a versão do schema', () => {
    expect(schema.version).toBe(2);
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

  it('as tabelas criadas pela migração têm as mesmas colunas do schema v2', () => {
    const passos = stepsForMigration({ migrations, fromVersion: 1, toVersion: 2 })!;
    for (const passo of passos) {
      if (passo.type !== 'create_table') continue;
      expect(passo.schema.columns).toEqual(schema.tables[passo.schema.name].columns);
    }
  });

  it('banco v1 real migra para v2 preservando acoes_pendentes e jornadas', async () => {
    const adapterV1 = new LokiJSAdapter({
      dbName: `migracao-${Math.random()}`,
      schema: schemaV1,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    const bancoV1 = new Database({ adapter: adapterV1, modelClasses: [Jornada, BancoHoras, AcaoPendente] });

    await bancoV1.write(async () => {
      await bancoV1.get<AcaoPendente>('acoes_pendentes').create((acao) => {
        acao.tipo = 'checkin';
        acao.idCliente = 'id-pendente-1';
        acao.payload = '{"latitude":-19.9}';
        acao.criadoEm = '2026-10-16T12:00:00.000Z';
        acao.status = 'pendente';
        acao.mensagemDescarte = null;
      });
      await bancoV1.get<Jornada>('jornadas').create((j) => {
        j.remoteId = 9;
        j.usuarioId = 7;
        j.status = 'EM_ANDAMENTO';
        j.checkinAt = '2026-10-16T11:00:03.000Z';
        j.lancadoEmAtraso = false;
        j.criadoEm = '2026-10-16T11:00:03.000Z';
        j.idClienteCheckin = 'id-pendente-1';
      });
    });

    // `testClone` reabre o mesmo armazenamento (em memória) com outro schema —
    // é como o WatermelonDB simula, nos próprios testes, o app atualizado.
    const adapterV2 = await (
      adapterV1 as unknown as { testClone(opcoes: object): Promise<LokiJSAdapter> }
    ).testClone({ schema, migrations });
    const bancoV2 = new Database({ adapter: adapterV2, modelClasses });

    const acoes = await bancoV2.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(acoes).toHaveLength(1);
    expect(acoes[0].idCliente).toBe('id-pendente-1');
    expect(acoes[0].payload).toBe('{"latitude":-19.9}');
    expect(acoes[0].status).toBe('pendente');

    const jornadas = await bancoV2.get<Jornada>('jornadas').query().fetch();
    expect(jornadas).toHaveLength(1);
    expect(jornadas[0].remoteId).toBe(9);
    expect(jornadas[0].idClienteCheckin).toBe('id-pendente-1');
    expect(jornadas[0].pedidoId).toBeNull();
    expect(jornadas[0].checkinIdCliente).toBeNull();
    expect(jornadas[0].checkoutIdCliente).toBeNull();

    for (const tabela of TABELAS_NOVAS) {
      expect(await bancoV2.get(tabela).query().fetchCount()).toBe(0);
    }

    // E o banco migrado aceita o pull do contrato nas tabelas novas.
    await gravarPullNaReplica(bancoV2, syncPullFixture);
    expect(await bancoV2.get<Pedido>('pedidos').query().fetchCount()).toBe(
      syncPullFixture.changes.pedidos.updated.length,
    );
    expect(await bancoV2.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(1);
  });
});
