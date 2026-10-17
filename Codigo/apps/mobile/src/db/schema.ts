import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Schema local do app. Toda mudança aqui exige subir `version` E acrescentar o
 * passo correspondente em `migrations.ts` — subir a versão sem migração faz o
 * WatermelonDB resetar o banco e apagar `acoes_pendentes` (marcações ainda não
 * enviadas).
 *
 * Tabelas da réplica (`jornadas`, `banco_horas`, `pedidos`, `ambientes`,
 * `pecas`, `tipos_avaria`, `avarias`, `atestados`) espelham o contrato de pull
 * de `@montacontrol/shared` (`src/sync/tipos.ts`): colunas em `snake_case`
 * idênticas aos campos da linha do contrato (menos `id`, gerido pelo
 * WatermelonDB — o id local é o id do servidor, como string).
 *
 * v2: acrescenta a réplica (`pedidos`…`atestados`) e as colunas de `jornadas`
 * que o contrato pede. `remote_id`, `id_cliente_checkin` e `id_cliente_checkout`
 * seguem até a v3 (#112).
 */
export const schema = appSchema({
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
