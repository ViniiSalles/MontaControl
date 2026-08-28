import type { PropsAlerta, VarianteAlerta } from '@montacontrol/ui-contracts/alerta'
import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import { SimboloMaterial } from './SimboloMaterial'

const iconePorVariante: Record<VarianteAlerta, NomeIcone> = {
  sucesso: 'check_circle',
  aviso: 'warning',
  erro: 'cancel',
  info: 'info',
}

const classesPorVariante: Record<VarianteAlerta, string> = {
  sucesso: 'bg-success-container text-on-success-container',
  aviso: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  erro: 'bg-error-container text-on-error-container',
  info: 'bg-primary-fixed text-on-primary-fixed-variant',
}

/**
 * Ver plano §"Fluxos de aceite": `erro` (senha incorreta, N1T2), `aviso`
 * (sessão expirada, TI02; perfil não-Montador negado), `info`/`sucesso` para
 * os demais casos.
 */
export function Alerta({ variante, mensagem, titulo }: PropsAlerta) {
  return (
    <div
      role={variante === 'erro' ? 'alert' : 'status'}
      className={['flex items-start gap-12 rounded-lg p-16', classesPorVariante[variante]].join(' ')}
    >
      <SimboloMaterial nome={iconePorVariante[variante]} className="mt-2 shrink-0 text-xl" />
      <div className="space-y-4">
        {titulo && <p className="text-title-sm font-bold">{titulo}</p>}
        <p className="text-body-md">{mensagem}</p>
      </div>
    </div>
  )
}
