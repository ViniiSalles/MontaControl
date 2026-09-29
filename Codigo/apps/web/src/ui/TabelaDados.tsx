import { Fragment, type ReactNode } from 'react'

export interface ColunaTabela<T> {
  titulo: string
  render: (linha: T) => ReactNode
  alinhamento?: 'esquerda' | 'direita' | 'centro'
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
}

const alinhamentoPorProp = { esquerda: 'text-left', direita: 'text-right', centro: 'text-center' } as const

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
}: PropsTabelaDados<T>) {
  return (
    <div className="overflow-x-auto print:overflow-visible rounded-xl bg-surface-container-lowest shadow-elev1">
      <table aria-label={rotulo} className="w-full text-body-md text-on-surface">
        <thead className="bg-surface-container-low text-label-md uppercase text-on-surface-variant">
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.titulo}
                scope="col"
                className={['px-24 py-16 font-bold', alinhamentoPorProp[coluna.alinhamento ?? 'esquerda']].join(' ')}
              >
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr>
              <td colSpan={colunas.length} className="px-24 py-32 text-center text-on-surface-variant">
                {vazio}
              </td>
            </tr>
          )}
          {linhas.map((linha) => {
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
