import { StatusPeca } from '@montacontrol/shared';
import type { ConferirPecaRequest, PecaDTO, PedidoDoMontadorDTO } from '@montacontrol/shared';

/**
 * Regra local da bipagem (US02): roda inteira sobre a réplica, sem rede — o
 * montador descarrega na casa do cliente, muitas vezes sem sinal (N4T3). O
 * servidor repete a mesma regra quando a leitura sobe pela fila.
 */

/** O que a fila guarda de uma leitura: o corpo da API, mais a identidade e a hora no aparelho. */
export interface PayloadConferenciaNaFila extends ConferirPecaRequest {
  idCliente: string;
  lidaEm: string;
}

/** Leitura que ainda está na fila (pendente ou enviada sem o pull ter trazido a peça). */
export type LeituraNaFila = Pick<PayloadConferenciaNaFila, 'pedidoId' | 'codigoBarras'>;

/**
 * - `conferida`: DESCARREGADA (ou já ENTREGUE) na réplica;
 * - `aguardando_envio`: bipada aqui, a leitura ainda não voltou pelo pull;
 * - `faltando`: triada, ainda não bipada;
 * - `inconsistente`: foi bipada no descarregamento de outro pedido;
 * - `sem_codigo`: nem passou pela triagem — não há o que bipar, e falta.
 */
export type SituacaoPeca =
  | 'conferida'
  | 'aguardando_envio'
  | 'faltando'
  | 'inconsistente'
  | 'sem_codigo';

export interface PecaNaConferencia {
  peca: PecaDTO;
  situacao: SituacaoPeca;
}

export interface AmbienteNaConferencia {
  id: number;
  nome: string;
  pecas: PecaNaConferencia[];
  conferidas: number;
  total: number;
}

export interface ConferenciaDoPedido {
  pedido: PedidoDoMontadorDTO;
  ambientes: AmbienteNaConferencia[];
  conferidas: number;
  total: number;
}

export type ResultadoLeitura =
  | {
      tipo: 'conferida';
      codigoBarras: string;
      peca: PecaDTO;
      ambiente: string;
      /** Esta leitura fechou o ambiente: todas as peças dele foram bipadas. */
      ambienteCompleto: boolean;
    }
  | { tipo: 'ja_conferida'; codigoBarras: string; peca: PecaDTO; ambiente: string }
  | { tipo: 'outro_pedido'; codigoBarras: string; peca: PecaDTO; numeroPedido: string }
  | { tipo: 'nao_encontrada'; codigoBarras: string };

export function contaComoConferida(situacao: SituacaoPeca): boolean {
  return situacao === 'conferida' || situacao === 'aguardando_envio';
}

function situacaoDaPeca(peca: PecaDTO, lidasNaFila: ReadonlySet<string>): SituacaoPeca {
  if (peca.status === StatusPeca.DESCARREGADA || peca.status === StatusPeca.ENTREGUE) {
    return 'conferida';
  }
  if (peca.codigoBarras === null) return 'sem_codigo';
  if (lidasNaFila.has(peca.codigoBarras)) return 'aguardando_envio';
  return peca.status === StatusPeca.INCONSISTENTE ? 'inconsistente' : 'faltando';
}

/** Checklist do pedido ativo: réplica com as leituras da fila por cima. */
export function montarConferencia(
  pedido: PedidoDoMontadorDTO,
  leiturasNaFila: readonly LeituraNaFila[],
): ConferenciaDoPedido {
  const lidasNaFila = new Set(
    leiturasNaFila
      .filter((leitura) => leitura.pedidoId === pedido.id)
      .map((leitura) => leitura.codigoBarras),
  );

  const ambientes = pedido.ambientes.map((ambiente) => {
    const pecas = ambiente.pecas.map((peca) => ({
      peca,
      situacao: situacaoDaPeca(peca, lidasNaFila),
    }));
    return {
      id: ambiente.id,
      nome: ambiente.nome,
      pecas,
      conferidas: pecas.filter((item) => contaComoConferida(item.situacao)).length,
      total: pecas.length,
    };
  });

  return {
    pedido,
    ambientes,
    conferidas: ambientes.reduce((soma, ambiente) => soma + ambiente.conferidas, 0),
    total: ambientes.reduce((soma, ambiente) => soma + ambiente.total, 0),
  };
}

/**
 * Valida o código lido contra o pedido ativo (N4T1/N4T2). Peça de outro
 * pedido só é reconhecida se for de outro pedido do próprio montador — a
 * réplica não tem as dos demais; essas caem em `nao_encontrada` e o servidor
 * decide quando a leitura subir.
 */
export function classificarLeitura(
  codigoBarras: string,
  conferencia: ConferenciaDoPedido,
  pedidos: readonly PedidoDoMontadorDTO[],
): ResultadoLeitura {
  for (const ambiente of conferencia.ambientes) {
    const item = ambiente.pecas.find((candidata) => candidata.peca.codigoBarras === codigoBarras);
    if (!item) continue;
    if (contaComoConferida(item.situacao)) {
      return { tipo: 'ja_conferida', codigoBarras, peca: item.peca, ambiente: ambiente.nome };
    }
    return {
      tipo: 'conferida',
      codigoBarras,
      peca: item.peca,
      ambiente: ambiente.nome,
      ambienteCompleto: ambiente.conferidas + 1 === ambiente.total,
    };
  }

  for (const pedido of pedidos) {
    if (pedido.id === conferencia.pedido.id) continue;
    for (const ambiente of pedido.ambientes) {
      const peca = ambiente.pecas.find((candidata) => candidata.codigoBarras === codigoBarras);
      if (peca) return { tipo: 'outro_pedido', codigoBarras, peca, numeroPedido: pedido.numeroPedido };
    }
  }

  return { tipo: 'nao_encontrada', codigoBarras };
}

/**
 * A leitura sobe para o servidor? Já conferida não muda nada; a mesma leitura
 * ainda na fila também não precisa de outra cópia (a API é idempotente, mas
 * a câmera lê o mesmo código várias vezes por segundo).
 */
export function deveEnfileirar(
  resultado: ResultadoLeitura,
  pedidoId: number,
  leiturasNaFila: readonly LeituraNaFila[],
): boolean {
  if (resultado.tipo === 'ja_conferida') return false;
  return !leiturasNaFila.some(
    (leitura) => leitura.pedidoId === pedidoId && leitura.codigoBarras === resultado.codigoBarras,
  );
}
