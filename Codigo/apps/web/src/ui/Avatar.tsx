import { iniciais } from '../formatacao/nomes'

const tamanhoPorProp = {
  md: 'h-40 w-40 text-label-lg',
  lg: 'h-48 w-48 text-title-sm',
  xl: 'h-64 w-64 text-title-md',
} as const

interface PropsAvatar {
  nome: string
  /** URL (assinada) da foto de perfil; sem ela, iniciais sobre `primary-fixed`. */
  fotoUrl?: string | null
  tamanho?: keyof typeof tamanhoPorProp
}

export function Avatar({ nome, fotoUrl, tamanho = 'md' }: PropsAvatar) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={`Foto de ${nome}`}
        className={['shrink-0 rounded-full object-cover', tamanhoPorProp[tamanho]].join(' ')}
      />
    )
  }
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
