import type {
  StatusAmbiente,
  StatusAtestado,
  StatusAvaria,
  StatusJornada,
  StatusPeca,
  StatusPedido,
} from '../enums';

/**
 * Contrato do pull de sincronização (`GET /api/sync/pull`) — protocolo
 * `pullChanges` do WatermelonDB. A API monta a resposta, o app mobile grava
 * as linhas no banco local; os dois dependem só deste arquivo.
 *
 * Convenções de toda linha:
 * - colunas em `snake_case`, idênticas às do schema local do WatermelonDB;
 * - `id` e chaves estrangeiras (`pedido_id`, `peca_id`…) são o id do
 *   servidor **como string** (`"123"`); o id local é o do servidor;
 * - instantes em ISO 8601 (`string`); datas civis (`data_inicio`) em
 *   `YYYY-MM-DD` no fuso de operação; `Decimal` do Prisma como `number`;
 * - sem fotos (continuam online, por URL assinada) e sem dados pessoais de
 *   terceiros — nada de CPF, e-mail ou telefone (LGPD).
 */

/**
 * Versão do **contrato** do pull, enviada como `schemaVersion` na query.
 * Não é a versão do schema local do WatermelonDB (`appSchema.version`), que
 * evolui por conta própria com as migrações do aparelho.
 *
 * Deve subir sempre que o contrato mudar de forma incompatível — tabela ou
 * coluna removida/renomeada/com semântica nova. Acrescentar coluna opcional
 * não exige. O servidor recusa versões diferentes da dele (app antigo
 * precisa atualizar). Valor inicial 2, alinhado com o schema v2 do app.
 */
export const SYNC_SCHEMA_VERSION = 2;

/** Tabelas replicadas. Fonte única de `TabelaSync`; a ordem aqui não é significativa para o protocolo. */
export const TABELAS_SYNC = [
  'jornadas',
  'banco_horas',
  'pedidos',
  'ambientes',
  'pecas',
  'tipos_avaria',
  'avarias',
  'atestados',
] as const;

export type TabelaSync = (typeof TABELAS_SYNC)[number];

/** `GET /api/sync/pull?lastPulledAt=<ms|ausente>&schemaVersion=<n>`. */
export interface SyncPullQuery {
  /** Valor de `timestamp` do pull anterior; ausente no primeiro pull. */
  lastPulledAt?: number;
  schemaVersion: number;
}

/**
 * Jornada do montador logado. Só o check-in de uma jornada que não nasceu de
 * ponto em atraso (`lancado_em_atraso = false`) tem coordenada garantida; o
 * check-out é nulo enquanto a jornada está aberta.
 */
export interface SyncJornadaRow {
  id: string;
  /**
   * Exceção à regra de ids string: é `number` porque a coluna local v1 de
   * `jornadas.usuario_id` é numérica (o WatermelonDB sanitiza string em coluna
   * number para 0) e o schema só cresce de forma aditiva. A v3 da #112 manteve a
   * coluna.
   */
  usuario_id: number;
  /** Obra do check-in; `null` em jornada aberta antes da regra e em ponto em atraso. */
  pedido_id: string | null;
  status: StatusJornada;
  checkin_at: string | null;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  checkin_endereco: string | null;
  /** UUID gerado no aparelho; casa a jornada do servidor com a ação da fila. */
  checkin_id_cliente: string | null;
  checkout_at: string | null;
  checkout_latitude: number | null;
  checkout_longitude: number | null;
  checkout_endereco: string | null;
  checkout_id_cliente: string | null;
  /** Nasceu de um ponto em atraso aprovado — não tem coordenada. */
  lancado_em_atraso: boolean;
  criado_em: string;
}

/** Saldo do mês do montador; uma linha por (`mes`, `ano`). Horas decimais. */
export interface SyncBancoHorasRow {
  id: string;
  mes: number;
  ano: number;
  horas_trabalhadas: number;
  horas_previstas: number;
  saldo: number;
}

/** Pedido atribuído ao montador, com o cliente (local da obra) desnormalizado. */
export interface SyncPedidoRow {
  id: string;
  numero_pedido: string;
  status: StatusPedido;
  cliente_id: string;
  cliente_nome: string;
  cliente_endereco: string;
  cliente_cidade: string;
  cliente_estado: string;
  /** Referência do raio de tolerância do check-in. */
  cliente_latitude: number;
  cliente_longitude: number;
}

export interface SyncAmbienteRow {
  id: string;
  pedido_id: string;
  nome: string;
  status: StatusAmbiente;
}

export interface SyncPecaRow {
  id: string;
  ambiente_id: string;
  /** `null` enquanto a peça está PENDENTE — o código só existe depois da triagem. */
  codigo_barras: string | null;
  descricao: string;
  quantidade: number;
  status: StatusPeca;
}

/** Catálogo global, igual para todos os montadores. */
export interface SyncTipoAvariaRow {
  id: string;
  nome: string;
  descricao: string;
}

/** Avaria registrada pelo montador logado (quem registrou é sempre ele). */
export interface SyncAvariaRow {
  id: string;
  /** UUID do aparelho; `null` em avaria criada fora do app. */
  id_cliente: string | null;
  peca_id: string;
  /**
   * Rótulos snapshot para exibir "Meus reportes" offline. A peça, o ambiente e
   * o pedido saem da réplica na desalocação do montador, mas a avaria
   * permanece na janela de 30 dias; `peca_id` é só o vínculo, não se faz join.
   */
  peca_descricao: string;
  ambiente_nome: string;
  numero_pedido: string;
  tipo_avaria_id: string;
  descricao: string;
  status: StatusAvaria;
  analisada_em: string | null;
  parecer: string | null;
  criado_em: string;
}

/** Atestado do montador logado; a análise do RH chega por atualização da linha. */
export interface SyncAtestadoRow {
  id: string;
  id_cliente: string;
  /** `YYYY-MM-DD`. */
  data_inicio: string;
  /** `YYYY-MM-DD`, inclusivo. */
  data_fim: string;
  observacao: string | null;
  status: StatusAtestado;
  motivo_rejeicao: string | null;
  validado_em: string | null;
  criado_em: string;
}

/** Tabela → tipo da linha. É a única fonte do que cada tabela carrega. */
export interface SyncLinhasPorTabela {
  jornadas: SyncJornadaRow;
  banco_horas: SyncBancoHorasRow;
  pedidos: SyncPedidoRow;
  ambientes: SyncAmbienteRow;
  pecas: SyncPecaRow;
  tipos_avaria: SyncTipoAvariaRow;
  avarias: SyncAvariaRow;
  atestados: SyncAtestadoRow;
}

export type SyncLinha<T extends TabelaSync> = SyncLinhasPorTabela[T];

/**
 * Mudanças de uma tabela. O cliente usa `sendCreatedAsUpdated: true`: o
 * servidor pode mandar tudo em `updated` e deixar `created` vazio.
 * `deleted` são ids (string) que deixaram de existir ou de ser visíveis ao
 * montador.
 */
export interface SyncMudancas<Linha> {
  created: Linha[];
  updated: Linha[];
  deleted: string[];
}

export interface SyncPullResponse {
  changes: { [T in TabelaSync]: SyncMudancas<SyncLinha<T>> };
  /** Relógio do servidor em ms; o cliente o devolve como `lastPulledAt` no próximo pull. */
  timestamp: number;
}
