/** Calcula quais números de página devem ser exibidos na paginação com janela. */
export function paginasVisiveis(pagina: number, totalPaginas: number): (number | 'reticencias')[] {
  if (totalPaginas <= 1) {
    return [1]
  }

  const janela = new Set<number>()

  // Sempre mostrar primeira e última página
  janela.add(1)
  janela.add(totalPaginas)

  // Mostrar página atual e vizinhas (clamped)
  janela.add(Math.max(1, pagina - 1))
  janela.add(pagina)
  janela.add(Math.min(totalPaginas, pagina + 1))

  // Converter set para array ordenado
  let paginas = Array.from(janela).sort((a, b) => a - b)

  // Preencher gaps de exatamente 1 página (não adicionar reticências)
  const preenchida = new Set<number>()
  for (const p of paginas) {
    preenchida.add(p)
  }

  for (let i = 0; i < paginas.length - 1; i++) {
    const gap = paginas[i + 1] - paginas[i]
    if (gap === 2) {
      // Gap exatamente de 1 página, preencher
      preenchida.add(paginas[i] + 1)
    }
  }

  paginas = Array.from(preenchida).sort((a, b) => a - b)

  // Inserir reticências entre gaps maiores que 1
  const resultado: (number | 'reticencias')[] = []
  for (let i = 0; i < paginas.length; i++) {
    resultado.push(paginas[i])

    if (i < paginas.length - 1) {
      const gap = paginas[i + 1] - paginas[i]
      if (gap > 1) {
        resultado.push('reticencias')
      }
    }
  }

  return resultado
}
