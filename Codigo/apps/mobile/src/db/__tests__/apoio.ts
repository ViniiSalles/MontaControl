import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { sanitizedRaw } from '@nozbe/watermelondb/RawRecord';
import logger from '@nozbe/watermelondb/utils/common/logger';
import {
  StatusJornada,
  StatusPedido,
  TABELAS_SYNC,
  type SyncJornadaRow,
  type SyncPedidoRow,
  type SyncLinha,
  type SyncPullResponse,
  type TabelaSync,
} from '@montacontrol/shared';
import { schema } from '../schema';
import { migrations } from '../migrations';
import { Jornada } from '../Jornada';
import { BancoHoras } from '../BancoHoras';
import { AcaoPendente } from '../AcaoPendente';
import { Pedido } from '../Pedido';
import { Ambiente } from '../Ambiente';
import { Peca } from '../Peca';
import { TipoAvaria } from '../TipoAvaria';
import { Avaria } from '../Avaria';
import { Atestado } from '../Atestado';
import { Notificacao } from '../Notificacao';

// O LokiJSAdapter loga cada etapa de setup/migração (e avisa do `useIncrementalIndexedDB:
// false`) em `console.log/warn` — ruído em toda suíte de banco. Os testes verificam
// os dados, não os logs.
logger.silence();

/** Mesma lista de `database.ts` — o app real não pode ser importado aqui (SQLite nativo). */
export const modelClasses = [
  Jornada,
  BancoHoras,
  AcaoPendente,
  Pedido,
  Ambiente,
  Peca,
  TipoAvaria,
  Avaria,
  Atestado,
  Notificacao,
];

/** Banco local em memória, para teste — mesmo schema/modelos/migrações do app real, sem SQLite nativo. */
export function criarBancoDeTeste(): Database {
  const adapter = new LokiJSAdapter({
    dbName: `teste-${Math.random()}`,
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses });
}

/**
 * Grava as linhas `created` + `updated` de um pull direto nas tabelas da réplica
 * (sem `synchronize()`, que é da #112). O `id` local é o id do servidor — é o que
 * o protocolo `pullChanges` do WatermelonDB faz por baixo dos panos.
 */
export async function gravarPullNaReplica(database: Database, pull: SyncPullResponse): Promise<void> {
  await database.write(async () => {
    const preparados = TABELAS_SYNC.flatMap((tabela) => {
      const colecao = database.get(tabela);
      const { created, updated } = pull.changes[tabela];
      return [...created, ...updated].map((linha) =>
        colecao.prepareCreate((registro) => {
          registro._raw = sanitizedRaw({ ...linha }, colecao.schema);
        }),
      );
    });
    await database.batch(...preparados);
  });
}

/**
 * Grava linhas soltas (formato do contrato) na réplica, sem passar pelo
 * `synchronize()` — semeia o estado "já sincronizado" de um teste. Como
 * `gravarPullNaReplica`, grava com `_status: 'created'`; não serve para testar
 * lógica de estado não sincronizado.
 */
export async function gravarLinhasNaReplica<T extends TabelaSync>(
  database: Database,
  tabela: T,
  linhas: readonly SyncLinha<T>[],
): Promise<void> {
  await database.write(async () => {
    const colecao = database.get(tabela);
    await database.batch(
      ...linhas.map((linha) =>
        colecao.prepareCreate((registro) => {
          registro._raw = sanitizedRaw({ ...linha }, colecao.schema);
        }),
      ),
    );
  });
}

let sequenciaJornada = 900;

/** Linha de jornada do contrato: finalizada, com check-in e check-out; `parcial` sobrescreve. */
export function linhaDeJornada(parcial: Partial<SyncJornadaRow> = {}): SyncJornadaRow {
  sequenciaJornada += 1;
  return {
    id: String(sequenciaJornada),
    usuario_id: 7,
    pedido_id: '12',
    status: StatusJornada.FINALIZADA,
    checkin_at: '2026-10-15T11:00:00.000Z',
    checkin_latitude: -19.9191,
    checkin_longitude: -43.9386,
    checkin_endereco: 'Rua das Acácias, 120',
    checkin_id_cliente: `checkin-${sequenciaJornada}`,
    checkout_at: '2026-10-15T20:00:00.000Z',
    checkout_latitude: -19.9191,
    checkout_longitude: -43.9386,
    checkout_endereco: 'Rua das Acácias, 120',
    checkout_id_cliente: `checkout-${sequenciaJornada}`,
    lancado_em_atraso: false,
    criado_em: '2026-10-15T11:00:01.000Z',
    ...parcial,
  };
}

/**
 * Jornada em andamento com entrada há 1h no relógio corrente (dentro das 24h):
 * o ponto aberto que libera Bipagem e Avarias. A fixture de sync tem a 502 em
 * andamento, mas com entrada em data fixa — vencida para o relógio real.
 */
export function linhaDeJornadaAberta(parcial: Partial<SyncJornadaRow> = {}): SyncJornadaRow {
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return linhaDeJornada({
    status: StatusJornada.EM_ANDAMENTO,
    checkin_at: umaHoraAtras,
    criado_em: umaHoraAtras,
    checkout_at: null,
    checkout_latitude: null,
    checkout_longitude: null,
    checkout_endereco: null,
    checkout_id_cliente: null,
    ...parcial,
  });
}

interface DadosAcaoPendente {
  tipo: string;
  idCliente: string;
  payload: unknown;
  criadoEm?: string;
  status?: 'pendente' | 'descartada' | 'enviada';
}

/** Linha da fila (`acoes_pendentes`), do jeito que a outbox grava. */
export async function criarAcaoPendente(
  database: Database,
  { tipo, idCliente, payload, criadoEm = '2026-10-16T12:00:00.000Z', status = 'pendente' }: DadosAcaoPendente,
): Promise<AcaoPendente> {
  return database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = tipo;
      registro.idCliente = idCliente;
      registro.payload = JSON.stringify(payload);
      registro.criadoEm = criadoEm;
      registro.status = status;
      registro.mensagemDescarte = null;
    }),
  );
}

/** Linha de pedido do contrato (obra de "Maria Souza", em BH); `parcial` sobrescreve. */
export function linhaDePedido(parcial: Partial<SyncPedidoRow> = {}): SyncPedidoRow {
  return {
    id: '10',
    numero_pedido: 'PED-000010',
    status: StatusPedido.EM_ENTREGA,
    cliente_id: '3',
    cliente_nome: 'Maria Souza',
    cliente_endereco: 'Av. Afonso Pena, 1000',
    cliente_cidade: 'Belo Horizonte',
    cliente_estado: 'MG',
    cliente_latitude: -19.9325,
    cliente_longitude: -43.9382,
    ...parcial,
  };
}

/** Resposta de pull sem nenhuma mudança (todas as tabelas vazias), com o `timestamp` pedido. */
export function pullSemMudancas(timestamp: number): SyncPullResponse {
  return {
    changes: Object.fromEntries(
      TABELAS_SYNC.map((tabela) => [tabela, { created: [], updated: [], deleted: [] }]),
    ) as unknown as SyncPullResponse['changes'],
    timestamp,
  };
}
