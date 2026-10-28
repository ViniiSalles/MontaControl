import {
  addColumns,
  createTable,
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

/**
 * Migrações do schema local, da mais antiga para a mais nova. Ligadas ao
 * adaptador em `database.ts`: sem elas, subir `schema.version` reseta o banco
 * e apaga a fila `acoes_pendentes`.
 *
 * A migração do WatermelonDB só sabe criar tabela e acrescentar coluna
 * (`createTable`, `addColumns`) ou rodar SQL (`unsafeExecuteSql`, ignorado no
 * LokiJS dos testes) — remover coluna não é um passo suportado: basta tirá-la
 * do schema e do model; a coluna física fica órfã no SQLite, sem efeito.
 * Recriar a tabela por SQL foi descartado (mais arriscado, sem ganho). Todo
 * passo novo exige atualizar a cópia congelada do schema anterior no teste de
 * migração.
 */
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // Réplica local (contrato de pull de `@montacontrol/shared`).
        createTable({
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
        createTable({
          name: 'ambientes',
          columns: [
            { name: 'pedido_id', type: 'string', isIndexed: true },
            { name: 'nome', type: 'string' },
            { name: 'status', type: 'string' },
          ],
        }),
        createTable({
          name: 'pecas',
          columns: [
            { name: 'ambiente_id', type: 'string', isIndexed: true },
            { name: 'codigo_barras', type: 'string', isOptional: true },
            { name: 'descricao', type: 'string' },
            { name: 'quantidade', type: 'number' },
            { name: 'status', type: 'string' },
          ],
        }),
        createTable({
          name: 'tipos_avaria',
          columns: [
            { name: 'nome', type: 'string' },
            { name: 'descricao', type: 'string' },
          ],
        }),
        createTable({
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
        createTable({
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
        // `jornadas`: o que o contrato pede e a v1 não tinha.
        addColumns({
          table: 'jornadas',
          columns: [
            { name: 'pedido_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'checkin_id_cliente', type: 'string', isOptional: true },
            { name: 'checkout_id_cliente', type: 'string', isOptional: true },
          ],
        }),
        // Índices em colunas que já existiam na v1: o schema v2 os marca com
        // `isIndexed`, mas `addColumns` só indexa as colunas novas — para quem
        // migra, o índice sai daqui (mesmo nome que o WatermelonDB usa:
        // `<tabela>_<coluna>`). Bancos novos já nascem indexados pelo schema.
        unsafeExecuteSql(
          'create index if not exists "jornadas_status" on "jornadas" ("status");' +
            'create index if not exists "jornadas_checkin_at" on "jornadas" ("checkin_at");' +
            'create index if not exists "banco_horas_mes" on "banco_horas" ("mes");' +
            'create index if not exists "banco_horas_ano" on "banco_horas" ("ano");',
        ),
      ],
    },
    {
      toVersion: 3,
      steps: [
        // Estado otimista sai da réplica (`remote_id`, `id_cliente_*` fora do
        // schema). As linhas de `jornadas` e `banco_horas` da v2 vieram de GET
        // (id local aleatório, não o do servidor) ou eram jornadas otimistas
        // da fila; o primeiro `synchronize()` as traria de novo com o id do
        // servidor, duplicando. A réplica é refeita pelo pull; `acoes_pendentes`
        // não é tocada, e a sobreposição reexibe o que ainda está na fila.
        //
        // Também apaga as cópias de obra que o app v2 guardava no `local_storage`
        // (nome/endereço do cliente, dado pessoal): `obrasLocais` deixou de existir
        // e nada mais as removeria nos aparelhos migrados.
        unsafeExecuteSql(
          'delete from "jornadas";delete from "banco_horas";' +
            `delete from "local_storage" where "key" in ('obras_do_montador','obra_da_jornada_aberta');`,
        ),
      ],
    },
    {
      toVersion: 4,
      steps: [
        // Réplica das notificações do montador. Os índices de `lida` e `criada_em`
        // saem do `isIndexed` do próprio `createTable`. O primeiro pull após a
        // migração é completo (ver `pullChanges`).
        createTable({
          name: 'notificacoes',
          columns: [
            { name: 'tipo', type: 'string' },
            { name: 'titulo', type: 'string' },
            { name: 'mensagem', type: 'string' },
            { name: 'referencia_tipo', type: 'string', isOptional: true },
            { name: 'referencia_id', type: 'string', isOptional: true },
            { name: 'lida', type: 'boolean', isIndexed: true },
            { name: 'criada_em', type: 'string', isIndexed: true },
          ],
        }),
      ],
    },
  ],
});
