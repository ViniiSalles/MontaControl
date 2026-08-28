import type { TipografiaToken } from './tipos';

/**
 * Escala tipográfica (derivada de Material 3, ajustada pelo design system —
 * ver DESIGN.md §3: headlines com tracking -0.02em "editorial", labels em
 * caixa alta com tracking +0.05em). Não "corrigir" de volta aos valores
 * padrão do M3: os ajustes são intencionais.
 */
export const tipografia: Record<string, TipografiaToken> = {
  displayLg: { px: 57, lineHeight: 64, peso: 800, tracking: '-0.02em' },
  displayMd: { px: 45, lineHeight: 52, peso: 800, tracking: '-0.02em' },
  displaySm: { px: 36, lineHeight: 40, peso: 800, tracking: '-0.02em' },

  headlineLg: { px: 30, lineHeight: 36, peso: 800, tracking: '-0.02em' },
  headlineMd: { px: 24, lineHeight: 32, peso: 800, tracking: '-0.02em' },
  headlineSm: { px: 20, lineHeight: 28, peso: 700, tracking: '-0.02em' },

  titleLg: { px: 18, lineHeight: 24, peso: 700, tracking: '-0.01em' },
  titleMd: { px: 16, lineHeight: 24, peso: 600, tracking: '0' },
  titleSm: { px: 14, lineHeight: 20, peso: 700, tracking: '0' },

  bodyLg: { px: 16, lineHeight: 26, peso: 400, tracking: '0' },
  bodyMd: { px: 14, lineHeight: 21, peso: 400, tracking: '0' },
  bodySm: { px: 12, lineHeight: 18, peso: 400, tracking: '0' },

  labelLg: { px: 12, lineHeight: 16, peso: 700, tracking: '0.05em' },
  labelMd: { px: 11, lineHeight: 14, peso: 700, tracking: '0.05em' },
  labelSm: { px: 10, lineHeight: 12, peso: 700, tracking: '0.06em' },
  overline: { px: 10, lineHeight: 12, peso: 700, tracking: '0.2em' },
};
