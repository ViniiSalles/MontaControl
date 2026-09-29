import { useId } from 'react'

interface PropsCampoAreaTexto {
  rotulo: string
  valor: string
  aoAlterar: (valor: string) => void
  placeholder?: string
  erro?: string
}

/** Textarea no estilo dos inputs do DESIGN.md §5 (fundo `surface-container-low`, sem borda). */
export function CampoAreaTexto({ rotulo, valor, aoAlterar, placeholder, erro }: PropsCampoAreaTexto) {
  const id = useId()
  const erroId = `${id}-erro`
  return (
    <div className="space-y-6">
      <label htmlFor={id} className="block px-4 text-label-lg uppercase text-on-surface-variant">
        {rotulo}
      </label>
      <textarea
        id={id}
        rows={4}
        value={valor}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? erroId : undefined}
        onChange={(evento) => aoAlterar(evento.target.value)}
        className="w-full resize-y rounded-lg border-none bg-surface-container-low p-16 text-body-md text-on-surface placeholder:text-outline/60 focus:bg-surface-container-lowest focus:shadow-elev2 focus:outline-none"
      />
      {erro && (
        <p id={erroId} className="px-4 text-body-sm text-error">
          {erro}
        </p>
      )}
    </div>
  )
}
