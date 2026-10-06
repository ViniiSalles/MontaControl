/** Como a coluna é comparada — também define o texto do botão (A–Z, mais recente…). */
export type TipoOrdenacao = 'texto' | 'numero' | 'data' | 'hora'

export type DirecaoOrdenacao = 'asc' | 'desc'

export interface OrdenacaoColuna<T> {
  tipo: TipoOrdenacao
  /**
   * Valor comparado. Texto: a string exibida. Número: o número cru (não o
   * formatado). Data: ISO (`YYYY-MM-DD` ou instante), que ordena como texto.
   * Hora: `HH:MM` do dia, para comparar horários de dias diferentes.
   * `null` vai sempre para o fim, nas duas direções.
   */
  valor: (linha: T) => string | number | null | undefined
}

export interface OrdemTabela {
  /** Título da coluna — único por tabela. */
  coluna: string
  direcao: DirecaoOrdenacao
}

const comparadorTexto = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function comparar(a: string | number, b: string | number, tipo: TipoOrdenacao): number {
  if (tipo === 'numero') return Number(a) - Number(b)
  // Datas ISO ordenam corretamente como texto; o collator só entra no texto livre.
  if (tipo === 'data' || tipo === 'hora') return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
  return comparadorTexto.compare(String(a), String(b))
}

/**
 * Devolve uma cópia ordenada (não muta `linhas`). Ordenação estável: empate
 * mantém a ordem que veio da API. Sem `ordem`, devolve a lista como está.
 */
export function ordenarLinhas<T>(
  linhas: T[],
  colunas: Array<{ titulo: string; ordenacao?: OrdenacaoColuna<T> }>,
  ordem: OrdemTabela | null,
): T[] {
  if (!ordem) return linhas
  const ordenacao = colunas.find((coluna) => coluna.titulo === ordem.coluna)?.ordenacao
  if (!ordenacao) return linhas
  const sinal = ordem.direcao === 'asc' ? 1 : -1

  return [...linhas].sort((linhaA, linhaB) => {
    const a = ordenacao.valor(linhaA)
    const b = ordenacao.valor(linhaB)
    const aVazio = a === null || a === undefined || a === ''
    const bVazio = b === null || b === undefined || b === ''
    if (aVazio || bVazio) return aVazio === bVazio ? 0 : aVazio ? 1 : -1
    return sinal * comparar(a, b, ordenacao.tipo)
  })
}

/** Clique no cabeçalho: sem ordem → crescente → decrescente → sem ordem. */
export function proximaOrdem(atual: OrdemTabela | null, coluna: string): OrdemTabela | null {
  if (!atual || atual.coluna !== coluna) return { coluna, direcao: 'asc' }
  if (atual.direcao === 'asc') return { coluna, direcao: 'desc' }
  return null
}

const ROTULOS: Record<TipoOrdenacao, Record<DirecaoOrdenacao, string>> = {
  texto: { asc: 'A–Z', desc: 'Z–A' },
  numero: { asc: 'menor para maior', desc: 'maior para menor' },
  data: { asc: 'mais antigo primeiro', desc: 'mais recente primeiro' },
  hora: { asc: 'mais cedo primeiro', desc: 'mais tarde primeiro' },
}

export function rotuloDirecao(tipo: TipoOrdenacao, direcao: DirecaoOrdenacao): string {
  return ROTULOS[tipo][direcao]
}
