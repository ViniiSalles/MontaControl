import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { SimboloMaterial } from './SimboloMaterial'

interface PropsGavetaLateral {
  aberta: boolean
  aoFechar: () => void
  titulo: string
  /** Logo abaixo do título (ex.: ação "Marcar todas como lidas"). */
  acaoCabecalho?: ReactNode
  children: ReactNode
  rodape?: ReactNode
}

const SELETOR_FOCAVEL = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Gaveta modal ancorada à direita (`larguraGavetaNotificacoes`) sobre um fundo
 * escurecido — `notifica_es_web`. Fecha com Escape ou clique no fundo; o foco
 * entra no botão "Fechar" ao abrir, fica preso na gaveta e volta ao elemento
 * que a abriu ao fechar. Renderize-a FORA do cabeçalho `sticky`: o
 * `backdrop-blur` dele viraria o bloco de contenção do `fixed`.
 */
export function GavetaLateral({ aberta, aoFechar, titulo, acaoCabecalho, children, rodape }: PropsGavetaLateral) {
  const idTitulo = useId()
  const refPainel = useRef<HTMLDivElement>(null)
  const refBotaoFechar = useRef<HTMLButtonElement>(null)
  // `aoFechar` costuma ser uma função nova a cada render do pai; o ref evita
  // refazer o efeito (e roubar o foco de volta) por causa disso.
  const refAoFechar = useRef(aoFechar)
  useEffect(() => {
    refAoFechar.current = aoFechar
  })

  useEffect(() => {
    if (!aberta) return
    const abridor = document.activeElement instanceof HTMLElement ? document.activeElement : null
    refBotaoFechar.current?.focus()

    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape') refAoFechar.current()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      abridor?.focus()
    }
  }, [aberta])

  function prenderFoco(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Tab' || !refPainel.current) return
    const focaveis = refPainel.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)
    if (focaveis.length === 0) return
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault()
      ultimo.focus()
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault()
      primeiro.focus()
    }
  }

  if (!aberta) return null

  return (
    <div className="fixed inset-0 z-60 flex justify-end print:hidden">
      <div aria-hidden="true" onClick={aoFechar} className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" />
      <div
        ref={refPainel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onKeyDown={prenderFoco}
        className="relative flex h-full w-full max-w-larguraGavetaNotificacoes flex-col bg-surface-container-lowest shadow-elev4"
      >
        <header className="flex shrink-0 items-start justify-between gap-16 border-b border-outline-variant/30 px-24 pb-16 pt-24">
          <div className="min-w-0 space-y-4">
            <h2 id={idTitulo} className="text-headline-sm text-on-surface">
              {titulo}
            </h2>
            {acaoCabecalho}
          </div>
          <button
            ref={refBotaoFechar}
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-full p-4 text-on-surface-variant hover:bg-surface-container"
          >
            <SimboloMaterial nome="close" className="text-xl" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {rodape && (
          <footer className="shrink-0 border-t border-outline-variant/30 bg-surface-container-low px-24 py-16">
            {rodape}
          </footer>
        )}
      </div>
    </div>
  )
}
