import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import { SimboloMaterial } from './SimboloMaterial'

type TomIndicador = 'padrao' | 'destaque' | 'erro' | 'alerta'

const fundoPorTom: Record<TomIndicador, string> = {
  padrao: 'bg-surface-container-lowest text-on-surface shadow-elev1',
  destaque: 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-elev3',
  erro: 'bg-error-container text-on-error-container',
  alerta: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
}

const iconePorTom: Record<TomIndicador, string> = {
  padrao: 'bg-primary-fixed text-primary',
  destaque: 'bg-on-primary/15 text-on-primary',
  erro: 'bg-on-error-container/10 text-error',
  alerta: 'bg-on-tertiary-fixed-variant/10 text-tertiary',
}

interface PropsCartaoIndicador {
  rotulo: string
  valor: string
  complemento?: string
  icone?: NomeIcone
  tom?: TomIndicador
}

/** KPI dos rodapés/topos das telas RH do Stitch. */
export function CartaoIndicador({ rotulo, valor, complemento, icone, tom = 'padrao' }: PropsCartaoIndicador) {
  return (
    <div className={['flex items-center gap-16 rounded-xl p-24', fundoPorTom[tom]].join(' ')}>
      {icone && (
        <span className={['flex h-48 w-48 shrink-0 items-center justify-center rounded-full', iconePorTom[tom]].join(' ')}>
          <SimboloMaterial nome={icone} className="text-2xl" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-label-md uppercase opacity-80">{rotulo}</p>
        <p className="text-headline-md">
          {valor}
          {complemento && <span className="ml-8 text-body-sm font-normal opacity-80">{complemento}</span>}
        </p>
      </div>
    </div>
  )
}
