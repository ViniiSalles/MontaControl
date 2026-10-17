import {
  StatusAmbiente,
  StatusAtestado,
  StatusAvaria,
  StatusJornada,
  StatusPeca,
  StatusPedido,
} from '../enums';
import type { SyncPullResponse } from './tipos';

/**
 * Resposta completa e coerente de `GET /api/sync/pull` para o montador `7`,
 * usável como mock nos testes do mobile enquanto o endpoint não existe.
 *
 * Representa um pull incremental: o servidor manda tudo em `updated`
 * (o cliente usa `sendCreatedAsUpdated: true`) e `deleted` traz o que deixou
 * de ser visível ao montador (obra desalocada com seus ambientes e peças).
 */
export const syncPullFixture: SyncPullResponse = {
  changes: {
    jornadas: {
      created: [],
      updated: [
        {
          id: '501',
          usuario_id: '7',
          pedido_id: '12',
          status: StatusJornada.FINALIZADA,
          checkin_at: '2026-10-15T11:02:10.000Z',
          checkin_latitude: -19.9191234,
          checkin_longitude: -43.9386123,
          checkin_endereco: 'Rua das Acácias, 120, Belo Horizonte',
          checkin_id_cliente: '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a01',
          checkout_at: '2026-10-15T20:31:44.000Z',
          checkout_latitude: -19.9191301,
          checkout_longitude: -43.9386055,
          checkout_endereco: 'Rua das Acácias, 120, Belo Horizonte',
          checkout_id_cliente: '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a02',
          lancado_em_atraso: false,
          criado_em: '2026-10-15T11:02:11.000Z',
        },
        {
          id: '502',
          usuario_id: '7',
          pedido_id: '12',
          status: StatusJornada.EM_ANDAMENTO,
          checkin_at: '2026-10-16T11:00:03.000Z',
          checkin_latitude: -19.9191002,
          checkin_longitude: -43.9386399,
          checkin_endereco: null,
          checkin_id_cliente: '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a03',
          checkout_at: null,
          checkout_latitude: null,
          checkout_longitude: null,
          checkout_endereco: null,
          checkout_id_cliente: null,
          lancado_em_atraso: false,
          criado_em: '2026-10-16T11:30:20.000Z',
        },
        {
          // Ponto em atraso aprovado: sem coordenada e sem id de aparelho.
          id: '498',
          usuario_id: '7',
          pedido_id: null,
          status: StatusJornada.FINALIZADA,
          checkin_at: '2026-10-09T11:00:00.000Z',
          checkin_latitude: null,
          checkin_longitude: null,
          checkin_endereco: null,
          checkin_id_cliente: null,
          checkout_at: '2026-10-09T20:00:00.000Z',
          checkout_latitude: null,
          checkout_longitude: null,
          checkout_endereco: null,
          checkout_id_cliente: null,
          lancado_em_atraso: true,
          criado_em: '2026-10-10T13:15:00.000Z',
        },
      ],
      deleted: [],
    },
    banco_horas: {
      created: [],
      updated: [
        {
          id: '31',
          usuario_id: '7',
          mes: 8,
          ano: 2026,
          horas_trabalhadas: 176.5,
          horas_previstas: 176,
          saldo: 0.5,
        },
        {
          id: '32',
          usuario_id: '7',
          mes: 9,
          ano: 2026,
          horas_trabalhadas: 168,
          horas_previstas: 176,
          saldo: -8,
        },
        {
          id: '33',
          usuario_id: '7',
          mes: 10,
          ano: 2026,
          horas_trabalhadas: 72.25,
          horas_previstas: 88,
          saldo: -15.75,
        },
      ],
      deleted: [],
    },
    pedidos: {
      created: [],
      updated: [
        {
          id: '12',
          numero_pedido: 'PED-2026-0012',
          status: StatusPedido.EM_ENTREGA,
          cliente_id: '3',
          cliente_nome: 'Residencial Acácias',
          cliente_endereco: 'Rua das Acácias, 120',
          cliente_cidade: 'Belo Horizonte',
          cliente_estado: 'MG',
          cliente_latitude: -19.9191234,
          cliente_longitude: -43.9386123,
        },
      ],
      deleted: ['41'],
    },
    ambientes: {
      created: [],
      updated: [
        { id: '30', pedido_id: '12', nome: 'Cozinha', status: StatusAmbiente.COMPLETO },
        { id: '31', pedido_id: '12', nome: 'Quarto casal', status: StatusAmbiente.EM_PROGRESSO },
      ],
      deleted: ['150', '151'],
    },
    pecas: {
      created: [],
      updated: [
        {
          id: '301',
          ambiente_id: '30',
          codigo_barras: '7891000100103',
          descricao: 'Armário aéreo 80cm',
          quantidade: 1,
          status: StatusPeca.CARREGADA,
        },
        {
          id: '302',
          ambiente_id: '30',
          codigo_barras: '7891000100110',
          descricao: 'Caixa de parafusos 4x40',
          quantidade: 150,
          status: StatusPeca.CARREGADA,
        },
        {
          id: '303',
          ambiente_id: '31',
          codigo_barras: '7891000100127',
          descricao: 'Porta de correr 2,10m',
          quantidade: 2,
          status: StatusPeca.TRIADA,
        },
        {
          // Ainda sem triagem: o código de barras só existe depois dela.
          id: '304',
          ambiente_id: '31',
          codigo_barras: null,
          descricao: 'Painel lateral guarda-roupa',
          quantidade: 1,
          status: StatusPeca.PENDENTE,
        },
      ],
      deleted: ['900'],
    },
    tipos_avaria: {
      created: [],
      updated: [
        { id: '1', nome: 'Peça danificada', descricao: 'Dano de transporte ou manuseio.' },
        {
          id: '2',
          nome: 'Peça faltando',
          descricao: 'Peça prevista no pedido que não chegou à obra.',
        },
      ],
      deleted: [],
    },
    avarias: {
      created: [],
      updated: [
        {
          id: '77',
          id_cliente: '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a10',
          peca_id: '303',
          tipo_avaria_id: '1',
          descricao: 'Canto da porta lascado na descarga.',
          status: StatusAvaria.EM_ANALISE,
          analisada_em: null,
          parecer: null,
          criado_em: '2026-10-16T14:20:00.000Z',
        },
      ],
      deleted: [],
    },
    atestados: {
      created: [],
      updated: [
        {
          id: '9',
          usuario_id: '7',
          id_cliente: '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a20',
          data_inicio: '2026-09-22',
          data_fim: '2026-09-23',
          observacao: 'Consulta e repouso.',
          status: StatusAtestado.REJEITADO,
          motivo_rejeicao: 'Documento ilegível.',
          validado_em: '2026-09-25T13:00:00.000Z',
          criado_em: '2026-09-24T12:00:00.000Z',
        },
      ],
      deleted: [],
    },
  },
  timestamp: 1760648400000,
};
