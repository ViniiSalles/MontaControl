import { Fragment, useState, type ReactNode } from 'react'
import {
  ordenarLinhas,
  proximaOrdem,
  rotuloDirecao,
  type OrdemTabela,
  type OrdenacaoColuna,
} from '../formatacao/ordenacao'
import { SimboloMaterial } from './SimboloMaterial'

export interface ColunaTabela<T> {
  titulo: string
  render: (linha: T) => ReactNode
  alinhamento?: 'esquerda' | 'direita' | 'centro'
  /** Com isto, o cabeçalho vira botão que ordena a coluna pelo tipo do dado. */
  ordenacao?: OrdenacaoColuna<T>
}

interface PropsTabelaDados<T> {
  /** Nome acessível da tabela (`aria-label`). */
  rotulo: string
  colunas: ColunaTabela<T>[]
  linhas: T[]
  chave: (linha: T) => string | number
  vazio: string
  aoSelecionar?: (linha: T) => void
  selecionada?: string | number | null
  classeLinha?: (linha: T) => string
  /** Linhas adicionais logo abaixo da linha (ex.: turnos extras do espelho). */
  linhasExtras?: (linha: T) => ReactNode
  /**
   * Ordem controlada pela página — use quando há paginação: a página ordena
   * a lista inteira antes de fatiar (`ordenarLinhas`) e a tabela só exibe.
   * Sem estas props, a tabela ordena sozinha as linhas recebidas.
   */
  ordem?: OrdemTabela | null
  aoOrdenar?: (ordem: OrdemTabela | null) => void
}

const alinhamentoPorProp = { esquerda: 'text-left', direita: 'text-right', centro: 'text-center' } as const
const justificacaoPorProp = { esquerda: 'justify-start', direita: 'justify-end', centro: 'justify-center' } as const
const ariaSortPorDirecao = { asc: 'ascending', desc: 'descending' } as const

/**
 * Tabela "Precise Orchestrator" (DESIGN.md §5): sem linhas verticais nem
 * divisores opacos; cabeçalho label-caps; linha selecionável por clique ou
 * Enter/Espaço.
 */
export function TabelaDados<T>({
  rotulo,
  colunas,
  linhas,
  chave,
  vazio,
  aoSelecionar,
  selecionada,
  classeLinha,
  linhasExtras,
  ordem,
  aoOrdenar,
}: PropsTabelaDados<T>) {
  const [ordemInterna, setOrdemInterna] = useState<OrdemTabela | null>(null)
  const controlada = aoOrdenar !== undefined
  const ordemAtual = controlada ? (ordem ?? null) : ordemInterna
  const linhasExibidas = controlada ? linhas : ordenarLinhas(linhas, colunas, ordemInterna)

  function alternarOrdem(titulo: string) {
    if (controlada) aoOrdenar(proximaOrdem(ordemAtual, titulo))
    else setOrdemInterna((atual) => proximaOrdem(atual, titulo))
  }

  return (
    <div className="overflow-x-auto print:overflow-visible rounded-xl bg-surface-container-lowest shadow-elev1">
      <table aria-label={rotulo} className="w-full text-body-md text-on-surface">
        <thead className="bg-surface-container-low text-label-md uppercase text-on-surface-variant">
          <tr>
            {colunas.map((coluna) => {
              const alinhamento = coluna.alinhamento ?? 'esquerda'
              const direcao = ordemAtual?.coluna === coluna.titulo ? ordemAtual.direcao : null
              return (
                <th
                  key={coluna.titulo}
                  scope="col"
                  aria-sort={direcao ? ariaSortPorDirecao[direcao] : undefined}
                  className={['px-24 py-16 font-bold', alinhamentoPorProp[alinhamento]].join(' ')}
                >
                  {coluna.ordenacao ? (
                    <button
                      type="button"
                      onClick={() => alternarOrdem(coluna.titulo)}
                      title={
                        direcao
                          ? `Ordenado ${rotuloDirecao(coluna.ordenacao.tipo, direcao)}`
                          : `Ordenar ${rotuloDirecao(coluna.ordenacao.tipo, 'asc')}`
                      }
                      className={[
                        'group inline-flex w-full items-center gap-4 uppercase print:pointer-events-none',
                        justificacaoPorProp[alinhamento],
                        direcao ? 'text-primary' : 'hover:text-on-surface',
                      ].join(' ')}
                    >
                      {coluna.titulo}
                      <SimboloMaterial
                        nome={direcao === 'asc' ? 'arrow_upward' : direcao === 'desc' ? 'arrow_downward' : 'swap_vert'}
                        className={[
                          'text-base print:hidden',
                          direcao ? '' : 'opacity-40 group-hover:opacity-100',
                        ].join(' ')}
                      />
                    </button>
                  ) : (
                    coluna.titulo
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {linhasExibidas.length === 0 && (
            <tr>
              <td colSpan={colunas.length} className="px-24 py-32 text-center text-on-surface-variant">
                {vazio}
              </td>
            </tr>
          )}
          {linhasExibidas.map((linha) => {
            const id = chave(linha)
            const ativa = selecionada === id
            return (
              <Fragment key={id}>
                <tr
                  aria-current={aoSelecionar && ativa ? 'true' : undefined}
                  tabIndex={aoSelecionar ? 0 : undefined}
                  onClick={aoSelecionar ? () => aoSelecionar(linha) : undefined}
                  onKeyDown={
                    aoSelecionar
                      ? (evento) => {
                          if (evento.key === 'Enter' || evento.key === ' ') {
                            evento.preventDefault()
                            aoSelecionar(linha)
                          }
                        }
                      : undefined
                  }
                  className={[
                    'transition-colors',
                    aoSelecionar ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40' : '',
                    ativa ? 'bg-primary-fixed/40' : 'hover:bg-surface-container-low',
                    classeLinha?.(linha) ?? '',
                  ].join(' ')}
                >
                  {colunas.map((coluna) => (
                    <td
                      key={coluna.titulo}
                      className={['px-24 py-16 align-middle', alinhamentoPorProp[coluna.alinhamento ?? 'esquerda']].join(' ')}
                    >
                      {coluna.render(linha)}
                    </td>
                  ))}
                </tr>
                {linhasExtras?.(linha)}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
