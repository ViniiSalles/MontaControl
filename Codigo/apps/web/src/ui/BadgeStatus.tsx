import type { PropsBadge, VarianteBadge } from '@montacontrol/ui-contracts/badge'

/** Estilo "ink-well" (DESIGN.md §5): fundo dessaturado, texto de alto contraste. */
const classesPorVariante: Record<VarianteBadge, string> = {
  sucesso: 'bg-success-container text-on-success-container',
  aviso: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  erro: 'bg-error-container text-on-error-container',
  info: 'bg-primary-fixed text-on-primary-fixed-variant',
  neutro: 'bg-surface-container-highest text-on-surface-variant',
}

export function BadgeStatus({ variante, texto }: PropsBadge) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-12 py-4 text-label-md uppercase',
        classesPorVariante[variante],
      ].join(' ')}
    >
      {texto}
    </span>
  )
}
