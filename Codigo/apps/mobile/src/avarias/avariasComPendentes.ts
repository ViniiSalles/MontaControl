import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import { StatusAvaria } from '@montacontrol/shared';
import type { PedidoDoMontadorDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { AcaoPendente } from '../db/AcaoPendente';
import type { StatusAcao } from '../db/AcaoPendente';
import { Avaria } from '../db/Avaria';
import { TipoAvaria } from '../db/TipoAvaria';
import type { PayloadAvariaNaFila } from '../sincronizacao/payloadsDaFila';

/** Avaria como "Meus reportes" a mostra: a da réplica ou a que ainda só existe na fila. */
export interface AvariaExibida {
  /** Identidade estável na lista: o `idCliente` do aparelho (a réplica o traz de volta) ou o id do servidor. */
  chave: string;
  descricaoPeca: string;
  ambiente: string;
  numeroPedido: string;
  tipoAvaria: string;
  status: StatusAvaria;
  parecer: string | null;
  criadoEm: string;
  /** Ainda não saiu do aparelho: o servidor não confirmou. */
  aguardandoEnvio: boolean;
}

/** Linha da réplica (`avarias`) já com os tipos primitivos que a tela usa. */
export interface AvariaDaReplica {
  id: string;
  idCliente: string | null;
  pecaDescricao: string;
  ambienteNome: string;
  numeroPedido: string;
  tipoAvariaId: number;
  status: StatusAvaria;
  parecer: string | null;
  criadoEm: string;
}

/**
 * Avaria na fila: `pendente` (ainda a enviar) ou `enviada` (o servidor aceitou
 * e o pull ainda não a trouxe — a lista não pode perdê-la nesse intervalo).
 */
export interface AvariaNaFila {
  idCliente: string;
  payload: PayloadAvariaNaFila;
  criadoEm: string;
  status: 'pendente' | 'enviada';
}

const STATUS_NA_SOBREPOSICAO: StatusAcao[] = ['pendente', 'enviada'];
const ROTULO_TIPO_DESCONHECIDO = 'Problema na peça';

/** Colunas da réplica que mudam in-place num `synchronize()` (a análise do gestor) e reemitem a consulta. */
export const COLUNAS_OBSERVADAS_DE_AVARIA = [
  'id_cliente',
  'peca_descricao',
  'ambiente_nome',
  'numero_pedido',
  'tipo_avaria_id',
  'status',
  'parecer',
];
export const COLUNAS_OBSERVADAS_DE_TIPO_AVARIA = ['nome', 'descricao'];
/** `pendente` → `enviada` é mudança de coluna: sem observá-la o selo "Aguardando envio" ficaria preso. */
export const COLUNAS_OBSERVADAS_DE_ACAO = ['status'];

export const queryAvarias = (database: Database): Query<Avaria> =>
  database.get<Avaria>('avarias').query();
export const queryTiposAvaria = (database: Database): Query<TipoAvaria> =>
  database.get<TipoAvaria>('tipos_avaria').query();

export function queryAcoesDeAvaria(database: Database): Query<AcaoPendente> {
  return database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('tipo', 'avaria'), Q.where('status', Q.oneOf(STATUS_NA_SOBREPOSICAO)));
}

export function paraAvariaDaReplica(avaria: Avaria): AvariaDaReplica {
  return {
    id: avaria.id,
    idCliente: avaria.idCliente,
    pecaDescricao: avaria.pecaDescricao,
    ambienteNome: avaria.ambienteNome,
    numeroPedido: avaria.numeroPedido,
    tipoAvariaId: Number(avaria.tipoAvariaId),
    status: avaria.status as StatusAvaria,
    parecer: avaria.parecer,
    criadoEm: avaria.criadoEm,
  };
}

export function paraTipoAvaria(tipo: TipoAvaria): TipoAvariaDTO {
  return { id: Number(tipo.id), nome: tipo.nome, descricao: tipo.descricao };
}

/** `null` para payload ilegível — a sobreposição só mostra o que entende. */
export function paraAvariaNaFila(acao: AcaoPendente): AvariaNaFila | null {
  try {
    return {
      idCliente: acao.idCliente,
      payload: JSON.parse(acao.payload) as PayloadAvariaNaFila,
      criadoEm: acao.criadoEm,
      status: acao.status === 'enviada' ? 'enviada' : 'pendente',
    };
  } catch {
    return null;
  }
}

interface EntradaDaLista {
  replica: readonly AvariaDaReplica[];
  acoes: readonly AvariaNaFila[];
  tipos: readonly TipoAvariaDTO[];
  /** Pedidos montados da réplica: de onde saem os rótulos da peça de uma avaria só-da-fila. */
  pedidos: readonly PedidoDoMontadorDTO[];
}

interface RotulosDaPeca {
  descricao: string;
  ambiente: string;
  numeroPedido: string;
}

function rotulosPorPeca(pedidos: readonly PedidoDoMontadorDTO[]): Map<number, RotulosDaPeca> {
  const rotulos = new Map<number, RotulosDaPeca>();
  for (const pedido of pedidos) {
    for (const ambiente of pedido.ambientes) {
      for (const peca of ambiente.pecas) {
        rotulos.set(peca.id, {
          descricao: peca.descricao,
          ambiente: ambiente.nome,
          numeroPedido: pedido.numeroPedido,
        });
      }
    }
  }
  return rotulos;
}

/**
 * Réplica + avarias na fila por cima, mais recente primeiro. A da fila some
 * assim que a réplica tem a avaria com o mesmo `idCliente`: o pull é quem a
 * substitui. Função pura.
 */
export function montarAvariasExibidas({
  replica,
  acoes,
  tipos,
  pedidos,
}: EntradaDaLista): AvariaExibida[] {
  const nomeDoTipo = new Map(tipos.map((tipo) => [tipo.id, tipo.nome]));
  const rotulosDaPeca = rotulosPorPeca(pedidos);
  const idsClienteNaReplica = new Set(
    replica.flatMap((avaria) => (avaria.idCliente ? [avaria.idCliente] : [])),
  );

  const daReplica: AvariaExibida[] = replica.map((avaria) => ({
    chave: avaria.idCliente ?? avaria.id,
    descricaoPeca: avaria.pecaDescricao,
    ambiente: avaria.ambienteNome,
    numeroPedido: avaria.numeroPedido,
    tipoAvaria: nomeDoTipo.get(avaria.tipoAvariaId) ?? ROTULO_TIPO_DESCONHECIDO,
    status: avaria.status,
    parecer: avaria.parecer,
    criadoEm: avaria.criadoEm,
    aguardandoEnvio: false,
  }));

  const daFila: AvariaExibida[] = acoes
    .filter((acao) => !idsClienteNaReplica.has(acao.idCliente))
    .map((acao) => {
      const peca = rotulosDaPeca.get(acao.payload.pecaId);
      return {
        chave: acao.idCliente,
        descricaoPeca: peca?.descricao ?? `Peça #${acao.payload.pecaId}`,
        ambiente: peca?.ambiente ?? '',
        numeroPedido: peca?.numeroPedido ?? '',
        tipoAvaria: nomeDoTipo.get(acao.payload.tipoAvariaId) ?? ROTULO_TIPO_DESCONHECIDO,
        status: StatusAvaria.REPORTADA,
        parecer: null,
        criadoEm: acao.criadoEm,
        aguardandoEnvio: acao.status === 'pendente',
      };
    });

  return [...daReplica, ...daFila].sort((a, b) =>
    a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0,
  );
}
