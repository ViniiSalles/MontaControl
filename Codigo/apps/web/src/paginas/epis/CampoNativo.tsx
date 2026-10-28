import type { ReactNode } from 'react'

/** Mesma aparência do `CampoTexto`, para `<select>` e `<input type="datetime-local">`. */
export const classeCampoNativo =
  'h-alturaCampo w-full rounded-lg border-none bg-surface-container-low px-16 text-body-lg text-on-surface focus:bg-surface-container-lowest focus:shadow-elev2 focus:outline-none'

interface PropsCampoNativo {
  id: string
  rotulo: string
  erro?: string
  children: ReactNode
}

/** Rótulo + controle nativo + erro, no layout dos campos do design system. */
export function CampoNativo({ id, rotulo, erro, children }: PropsCampoNativo) {
  return (
    <div className="space-y-6">
      <label htmlFor={id} className="block px-4 text-label-lg uppercase text-on-surface-variant">
        {rotulo}
      </label>
      {children}
      {erro && <p className="px-4 text-body-sm text-error">{erro}</p>}
    </div>
  )
}
