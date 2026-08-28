import { useId } from 'react'
import type { PropsCheckbox } from '@montacontrol/ui-contracts/checkbox'

/** Ver `login_montacontrol:135-138`. `accent-primary` (nativo do Tailwind, sem plugin) no lugar do `plugins=forms` do mockup. */
export function Checkbox({ rotulo, marcado, aoAlterar, desabilitado = false }: PropsCheckbox) {
  const id = useId()
  return (
    <div className="flex items-center">
      <input
        id={id}
        type="checkbox"
        checked={marcado}
        disabled={desabilitado}
        onChange={(evento) => aoAlterar(evento.target.checked)}
        className="h-16 w-16 rounded-xs border-outline-variant/30 accent-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      />
      <label htmlFor={id} className="ml-8 cursor-pointer text-body-md text-on-surface-variant">
        {rotulo}
      </label>
    </div>
  )
}
