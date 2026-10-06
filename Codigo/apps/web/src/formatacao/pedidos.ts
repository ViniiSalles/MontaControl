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

/** Teto de linhas por planilha — protege o formulário de um arquivo errado com milhares de linhas. */
export const MAXIMO_ITENS_PLANILHA = 500
const TAMANHO_MAXIMO_DESCRICAO = 200

export type ResultadoPlanilha = { itens: RascunhoItem[] } | { erro: string }

function normalizarCabecalho(celula: unknown): string {
  return typeof celula === 'string'
    ? celula
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .toLowerCase()
    : ''
}

// Nome exato da coluna (fora "descrição…"): uma peça chamada "Peça lateral"
// na primeira linha não pode ser confundida com cabeçalho.
const NOMES_COLUNA_DESCRICAO = ['peca', 'pecas', 'item', 'itens', 'produto', 'produtos', 'nome']
const ehCabecalhoDescricao = (texto: string) =>
  texto.startsWith('descricao') ||
  NOMES_COLUNA_DESCRICAO.includes(texto.replace(/[.:]/g, '').trim())
const ehCabecalhoQuantidade = (texto: string) => /^(qtd|qtde|quant)[a-z]*[.:]?$/.test(texto)

function celulaVazia(celula: unknown): boolean {
  return celula === null || celula === undefined || String(celula).trim() === ''
}

/**
 * Converte as linhas da primeira aba do Excel em peças do ambiente. Aceita
 * planilha com cabeçalho (coluna "Descrição"/"Peça" e, opcional,
 * "Quantidade"/"Qtd") ou sem cabeçalho (coluna A = descrição, B = quantidade).
 * Quantidade em branco vale 1. Linhas totalmente vazias são ignoradas.
 */
export function extrairItensDaPlanilha(linhas: readonly (readonly unknown[])[]): ResultadoPlanilha {
  const inicio = linhas.findIndex((linha) => linha.some((celula) => !celulaVazia(celula)))
  if (inicio === -1) return { erro: 'A planilha está vazia.' }

  const cabecalho = linhas[inicio].map(normalizarCabecalho)
  const colunaDescricaoCabecalho = cabecalho.findIndex(ehCabecalhoDescricao)
  const temCabecalho = colunaDescricaoCabecalho !== -1
  const colunaDescricao = temCabecalho ? colunaDescricaoCabecalho : 0
  const colunaQuantidade = temCabecalho ? cabecalho.findIndex(ehCabecalhoQuantidade) : 1

  const itens: RascunhoItem[] = []
  for (let indice = temCabecalho ? inicio + 1 : inicio; indice < linhas.length; indice++) {
    const linha = linhas[indice]
    const numeroLinha = indice + 1
    const celulaDescricao = linha[colunaDescricao]
    const celulaQuantidade = colunaQuantidade === -1 ? null : linha[colunaQuantidade]

    if (celulaVazia(celulaDescricao)) {
      if (celulaVazia(celulaQuantidade)) continue
      return { erro: `Linha ${numeroLinha}: peça sem descrição.` }
    }

    const descricao = String(celulaDescricao).trim()
    if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
      return {
        erro: `Linha ${numeroLinha}: descrição com mais de ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`,
      }
    }

    const quantidade = celulaVazia(celulaQuantidade) ? 1 : Number(String(celulaQuantidade).trim())
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      return {
        erro: `Linha ${numeroLinha}: quantidade de ${descricao} precisa ser um número inteiro maior que zero.`,
      }
    }

    itens.push({ descricao, quantidade: String(quantidade) })
    if (itens.length > MAXIMO_ITENS_PLANILHA) {
      return { erro: `A planilha passa do limite de ${MAXIMO_ITENS_PLANILHA} peças por ambiente.` }
    }
  }

  if (itens.length === 0) return { erro: 'Nenhuma peça encontrada na planilha.' }
  return { itens }
}

/** Junta as peças importadas às já digitadas, descartando as linhas em branco do formulário. */
export function adicionarItensImportados(
  ambiente: RascunhoAmbiente,
  importados: RascunhoItem[],
): RascunhoAmbiente {
  const preenchidos = ambiente.itens.filter((item) => item.descricao.trim() !== '')
  return { ...ambiente, itens: [...preenchidos, ...importados] }
}
