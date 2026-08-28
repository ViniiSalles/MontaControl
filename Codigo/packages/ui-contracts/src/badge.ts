export type VarianteBadge = 'sucesso' | 'aviso' | 'erro' | 'info' | 'neutro';

/** `label-sm` uppercase, `raio.full` — ver plano §5 "Ink-well". */
export interface PropsBadge {
  variante: VarianteBadge;
  texto: string;
}
