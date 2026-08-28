import type { PropsBotao, TamanhoBotao } from '@montacontrol/ui-contracts/botao'
import { SimboloMaterial } from './SimboloMaterial'

const alturaPorTamanho: Record<TamanhoBotao, string> = {
  40: 'h-40',
  48: 'h-48',
  56: 'h-alturaCampo',
}

const larguraPorTamanho: Record<TamanhoBotao, string> = {
  40: 'w-40',
  48: 'w-48',
  56: 'w-alturaCampo',
}

const formaPorProp: Record<PropsBotao['forma'], string> = {
  pilula: 'rounded-full',
  retangular: 'rounded-lg',
}

const classesPorVariante: Record<PropsBotao['variante'], string> = {
  primario:
    'bg-gradient-to-tr from-primary to-primary-container text-on-primary shadow-marca hover:brightness-110',
  tonal: 'bg-primary-container text-on-primary-container hover:brightness-105',
  fantasma: 'bg-transparent text-primary hover:bg-primary-container/10',
  perigo: 'bg-error text-on-error hover:brightness-105',
  icone: 'bg-transparent text-on-surface-variant hover:bg-surface-container',
}

/** Ver `login_montacontrol:139` — contrato completo em `@montacontrol/ui-contracts/botao`. */
export function Botao({
  variante,
  tamanho,
  forma,
  texto,
  icone,
  carregando = false,
  larguraTotal = false,
  desabilitado = false,
  aoPressionar,
}: PropsBotao) {
  const ehIcone = variante === 'icone'

  return (
    <button
      type="button"
      onClick={aoPressionar}
      disabled={desabilitado || carregando}
      className={[
        'inline-flex items-center justify-center gap-8 font-bold transition-all active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-40',
        alturaPorTamanho[tamanho],
        ehIcone ? larguraPorTamanho[tamanho] : 'px-24',
        formaPorProp[forma],
        classesPorVariante[variante],
        larguraTotal ? 'w-full' : '',
      ].join(' ')}
    >
      {carregando ? (
        <span
          aria-hidden="true"
          className="h-20 w-20 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <>
          {icone && <SimboloMaterial nome={icone} className="text-xl" />}
          {!ehIcone && texto && <span className="text-title-md">{texto}</span>}
        </>
      )}
    </button>
  )
}
