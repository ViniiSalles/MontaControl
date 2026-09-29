import type { ReactNode } from 'react'
import { SimboloMaterial } from './SimboloMaterial'

interface PropsPainelLateral {
  titulo: string
  subtitulo?: string
  aoFechar?: () => void
  children: ReactNode
  rodape?: ReactNode
}

/**
 * Painel de detalhe à direita (master/detail) — `gest_o_de_atestados`,
 * `banco_de_horas`. Em `lg`, fica `sticky` abaixo do cabeçalho e limitado à
 * altura da viewport (`topoPainelLateral` = `alturaBarraSuperior` +
 * `paddingTelaWeb`, ver `espacamento.ts`) — só o corpo rola
 * (`min-h-0 flex-1 overflow-y-auto`), cabeçalho e rodapé sempre visíveis.
 */
export function PainelLateral({ titulo, subtitulo, aoFechar, children, rodape }: PropsPainelLateral) {
  return (
    <aside
      aria-label={titulo}
      className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-elev3 lg:sticky lg:top-topoPainelLateral lg:w-larguraPainelLateral lg:max-h-[calc(100dvh-theme(spacing.topoPainelLateral)-theme(spacing.32))]"
    >
      <header className="flex shrink-0 items-start justify-between gap-16 px-24 pb-16 pt-24">
        <div>
          <h2 className="text-headline-sm text-on-surface">{titulo}</h2>
          {subtitulo && <p className="text-body-sm text-on-surface-variant">{subtitulo}</p>}
        </div>
        {aoFechar && (
          <button type="button" onClick={aoFechar} aria-label="Fechar detalhes" className="rounded-full p-4 hover:bg-surface-container">
            <SimboloMaterial nome="close" className="text-xl text-on-surface-variant" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-24 overflow-y-auto px-24 pb-24">{children}</div>
      {rodape && <footer className="flex shrink-0 gap-12 bg-surface-container-low px-24 py-16">{rodape}</footer>}
    </aside>
  )
}
