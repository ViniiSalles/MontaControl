import type { CriarPedidoRequest, PedidoResumoDTO } from '@montacontrol/shared'

export interface RascunhoItem {
  descricao: string
  /** Texto do campo — só vira número depois de validado. */
  quantidade: string
}

export interface RascunhoAmbiente {
  nome: string
  itens: RascunhoItem[]
}

export interface RascunhoPedido {
  clienteId: number | null
  ambientes: RascunhoAmbiente[]
}

export function progressoDoPedido(
  pedido: Pick<PedidoResumoDTO, 'quantidadeTotal' | 'quantidadeTriada'>,
): string {
  return `${pedido.quantidadeTriada}/${pedido.quantidadeTotal}`
}

/** Mensagem do primeiro problema encontrado, ou `null` quando o rascunho está pronto. */
export function validarRascunhoPedido(rascunho: RascunhoPedido): string | null {
  if (!rascunho.clienteId) return 'Selecione o cliente da obra.'
  if (rascunho.ambientes.length === 0) return 'Adicione ao menos um ambiente.'

  for (const ambiente of rascunho.ambientes) {
    if (!ambiente.nome.trim()) return 'Todo ambiente precisa de um nome.'
    if (ambiente.itens.length === 0) return `Adicione ao menos um item em ${ambiente.nome.trim()}.`

    for (const item of ambiente.itens) {
      if (!item.descricao.trim()) return 'Toda peça precisa de uma descrição.'
      const quantidade = Number(item.quantidade)
      if (!Number.isInteger(quantidade) || quantidade < 1) {
        return `Quantidade de ${item.descricao.trim()} precisa ser um número inteiro maior que zero.`
      }
    }
  }

  return null
}

export function converterRascunhoPedido(rascunho: RascunhoPedido): CriarPedidoRequest {
  return {
    clienteId: rascunho.clienteId as number,
    ambientes: rascunho.ambientes.map((ambiente) => ({
      nome: ambiente.nome.trim(),
      itens: ambiente.itens.map((item) => ({
        descricao: item.descricao.trim(),
        quantidade: Number(item.quantidade),
      })),
    })),
  }
}
