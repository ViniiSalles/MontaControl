import { SimboloMaterial } from './SimboloMaterial'

interface PropsPaginacao {
  pagina: number
  totalPaginas: number
  /** Ex.: "Mostrando 10 de 142 montadores". */
  resumo: string
  aoMudar: (pagina: number) => void
}

/** Botões "ghost", página ativa em `primary` (DESIGN.md §5). */
export function Paginacao({ pagina, totalPaginas, resumo, aoMudar }: PropsPaginacao) {
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between px-24 py-16">
      <p className="text-body-sm text-on-surface-variant">{resumo}</p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)} className="rounded-lg p-8 text-on-surface-variant disabled:opacity-40">
            <SimboloMaterial nome="chevron_left" className="text-xl" />
          </button>
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
            <button
              key={numero}
              type="button"
              aria-current={numero === pagina ? 'page' : undefined}
              onClick={() => aoMudar(numero)}
              className={[
                'h-32 min-w-32 rounded-lg px-8 text-label-lg',
                numero === pagina ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container',
              ].join(' ')}
            >
              {numero}
            </button>
          ))}
          <button type="button" aria-label="Próxima página" disabled={pagina >= totalPaginas} onClick={() => aoMudar(pagina + 1)} className="rounded-lg p-8 text-on-surface-variant disabled:opacity-40">
            <SimboloMaterial nome="chevron_right" className="text-xl" />
          </button>
        </div>
      )}
    </nav>
  )
}
