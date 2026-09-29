import { iniciais } from '../formatacao/nomes'

const tamanhoPorProp = {
  md: 'h-40 w-40 text-label-lg',
  lg: 'h-48 w-48 text-title-sm',
} as const

/** Stitch usa foto; não há foto de usuário no domínio, então iniciais sobre `primary-fixed`. */
export function Avatar({ nome, tamanho = 'md' }: { nome: string; tamanho?: keyof typeof tamanhoPorProp }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-fixed font-bold text-on-primary-fixed-variant',
        tamanhoPorProp[tamanho],
      ].join(' ')}
    >
      {iniciais(nome)}
    </span>
  )
}
