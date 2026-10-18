import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import { StatusAtestado } from '@montacontrol/shared';
import { AcaoPendente } from '../db/AcaoPendente';
import type { StatusAcao } from '../db/AcaoPendente';
import { Atestado } from '../db/Atestado';
import type { PayloadAtestadoNaFila } from '../sincronizacao/payloadsDaFila';

/** Atestado como "Histórico recente" o mostra: o da réplica ou o que ainda só existe na fila. */
export interface AtestadoExibido {
  /** Identidade estável na lista: o `idCliente` do aparelho (a réplica o traz de volta). */
  chave: string;
  dataInicio: string;
  dataFim: string;
  observacao: string | null;
  status: StatusAtestado;
  motivoRejeicao: string | null;
  criadoEm: string;
  /** Ainda não saiu do aparelho: o servidor não confirmou. */
  aguardandoEnvio: boolean;
}

/** Linha da réplica (`atestados`) com os tipos que a tela usa; a análise do RH chega por atualização da linha. */
export interface AtestadoDaReplica {
  id: string;
  idCliente: string;
  dataInicio: string;
  dataFim: string;
  observacao: string | null;
  status: StatusAtestado;
  motivoRejeicao: string | null;
  criadoEm: string;
}

/** `pendente` (a enviar) ou `enviada` (aceito, aguardando o pull trazê-lo). */
export interface AtestadoNaFila {
  idCliente: string;
  payload: PayloadAtestadoNaFila;
  criadoEm: string;
  status: 'pendente' | 'enviada';
}

const STATUS_NA_SOBREPOSICAO: StatusAcao[] = ['pendente', 'enviada'];

/** Colunas da réplica que mudam in-place num `synchronize()` (a decisão do RH) e reemitem a consulta. */
export const COLUNAS_OBSERVADAS_DE_ATESTADO = [
  'id_cliente',
  'data_inicio',
  'data_fim',
  'observacao',
  'status',
  'motivo_rejeicao',
];
/** `pendente` → `enviada` é mudança de coluna: sem observá-la o selo "Aguardando envio" ficaria preso. */
export const COLUNAS_OBSERVADAS_DE_ACAO_DE_ATESTADO = ['status'];

export const queryAtestados = (database: Database): Query<Atestado> =>
  database.get<Atestado>('atestados').query();

export function queryAcoesDeAtestado(database: Database): Query<AcaoPendente> {
  return database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('tipo', 'atestado'), Q.where('status', Q.oneOf(STATUS_NA_SOBREPOSICAO)));
}

export function paraAtestadoDaReplica(atestado: Atestado): AtestadoDaReplica {
  return {
    id: atestado.id,
    idCliente: atestado.idCliente,
    dataInicio: atestado.dataInicio,
    dataFim: atestado.dataFim,
    observacao: atestado.observacao,
    status: atestado.status as StatusAtestado,
    motivoRejeicao: atestado.motivoRejeicao,
    criadoEm: atestado.criadoEm,
  };
}

/** `null` para payload ilegível — a sobreposição só mostra o que entende. */
export function paraAtestadoNaFila(acao: AcaoPendente): AtestadoNaFila | null {
  try {
    return {
      idCliente: acao.idCliente,
      payload: JSON.parse(acao.payload) as PayloadAtestadoNaFila,
      criadoEm: acao.criadoEm,
      status: acao.status === 'enviada' ? 'enviada' : 'pendente',
    };
  } catch {
    return null;
  }
}

/**
 * Réplica + atestados na fila por cima, mais recente primeiro. O da fila some
 * assim que a réplica tem o atestado com o mesmo `idCliente`. Função pura.
 */
export function montarAtestadosExibidos({
  replica,
  acoes,
}: {
  replica: readonly AtestadoDaReplica[];
  acoes: readonly AtestadoNaFila[];
}): AtestadoExibido[] {
  const idsClienteNaReplica = new Set(replica.map((atestado) => atestado.idCliente));

  const daReplica: AtestadoExibido[] = replica.map((atestado) => ({
    chave: atestado.idCliente,
    dataInicio: atestado.dataInicio,
    dataFim: atestado.dataFim,
    observacao: atestado.observacao,
    status: atestado.status,
    motivoRejeicao: atestado.motivoRejeicao,
    criadoEm: atestado.criadoEm,
    aguardandoEnvio: false,
  }));

  const daFila: AtestadoExibido[] = acoes
    .filter((acao) => !idsClienteNaReplica.has(acao.idCliente))
    .map((acao) => ({
      chave: acao.idCliente,
      dataInicio: acao.payload.dataInicio,
      dataFim: acao.payload.dataFim,
      observacao: acao.payload.observacao ?? null,
      status: StatusAtestado.PENDENTE,
      motivoRejeicao: null,
      criadoEm: acao.criadoEm,
      aguardandoEnvio: acao.status === 'pendente',
    }));

  return [...daReplica, ...daFila].sort((a, b) =>
    a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0,
  );
}
