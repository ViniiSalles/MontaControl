import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
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
