import { cores } from '../cores';
import { tipografia } from '../tipografia';
import { espacamento, espacamentoNomeado } from '../espacamento';
import { raio } from '../raio';
import { elevacao } from '../elevacao';

const px = (valor: number) => `${valor}px`;

/**
 * Mapa cores (camelCase) -> nomes de classe Tailwind (kebab-case), no
 * mesmo vocabulário do config inline do mockup Stitch (`bg-primary-container`,
 * `text-on-surface-variant`, etc.) para substituição 1:1.
 */
const colors: Record<string, string> = {
  primary: cores.primary,
  'on-primary': cores.onPrimary,
  'primary-container': cores.primaryContainer,
  'on-primary-container': cores.onPrimaryContainer,
  'primary-fixed': cores.primaryFixed,
  'primary-fixed-dim': cores.primaryFixedDim,
  'on-primary-fixed': cores.onPrimaryFixed,
  'on-primary-fixed-variant': cores.onPrimaryFixedVariant,
  'inverse-primary': cores.inversePrimary,

  secondary: cores.secondary,
  'on-secondary': cores.onSecondary,
  'secondary-container': cores.secondaryContainer,
  'on-secondary-container': cores.onSecondaryContainer,
  'secondary-fixed': cores.secondaryFixed,
  'secondary-fixed-dim': cores.secondaryFixedDim,
  'on-secondary-fixed': cores.onSecondaryFixed,
  'on-secondary-fixed-variant': cores.onSecondaryFixedVariant,

  tertiary: cores.tertiary,
  'on-tertiary': cores.onTertiary,
  'tertiary-container': cores.tertiaryContainer,
  'on-tertiary-container': cores.onTertiaryContainer,
  'tertiary-fixed': cores.tertiaryFixed,
  'tertiary-fixed-dim': cores.tertiaryFixedDim,
  'on-tertiary-fixed': cores.onTertiaryFixed,
  'on-tertiary-fixed-variant': cores.onTertiaryFixedVariant,

  error: cores.error,
  'on-error': cores.onError,
  'error-container': cores.errorContainer,
  'on-error-container': cores.onErrorContainer,

  success: cores.success,
  'on-success': cores.onSuccess,
  'success-container': cores.successContainer,
  'on-success-container': cores.onSuccessContainer,

  ancora: cores.ancora,
  'on-ancora': cores.onAncora,
  'on-ancora-variant': cores.onAncoraVariant,
  'on-ancora-apagado': cores.onAncoraApagado,
  'ancora-divisor': cores.ancoraDivisor,

  background: cores.background,
  'on-background': cores.onBackground,
  surface: cores.surface,
  'on-surface': cores.onSurface,
  'surface-variant': cores.surfaceVariant,
  'on-surface-variant': cores.onSurfaceVariant,
  'surface-tint': cores.surfaceTint,

  'surface-dim': cores.surfaceDim,
  'surface-bright': cores.surfaceBright,
  'surface-container-lowest': cores.surfaceContainerLowest,
  'surface-container-low': cores.surfaceContainerLow,
  'surface-container': cores.surfaceContainer,
  'surface-container-high': cores.surfaceContainerHigh,
  'surface-container-highest': cores.surfaceContainerHighest,

  'inverse-surface': cores.inverseSurface,
  'inverse-on-surface': cores.inverseOnSurface,

  outline: cores.outline,
  'outline-variant': cores.outlineVariant,

  scrim: cores.scrim,
  shadow: cores.shadow,
  'shadow-brand': cores.shadowBrand,
};

/**
 * Tailwind `fontSize` no formato `[tamanho, { lineHeight, letterSpacing,
 * fontWeight }]`. Chaves em kebab-case (convenção de classe Tailwind, ex.
 * `text-display-lg`).
 */
const fontSize: Record<string, [string, { lineHeight: string; letterSpacing: string; fontWeight: number }]> =
  Object.fromEntries(
    Object.entries(tipografia).map(([chave, token]) => [
      chave.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
      [px(token.px), { lineHeight: px(token.lineHeight), letterSpacing: token.tracking, fontWeight: token.peso }],
    ]),
  );

const spacing: Record<string, string> = {
  ...Object.fromEntries(Object.entries(espacamento).map(([chave, valor]) => [chave, px(valor)])),
  ...Object.fromEntries(Object.entries(espacamentoNomeado).map(([chave, valor]) => [chave, px(valor)])),
};

/**
 * Remapeamento deliberado das chaves default do Tailwind: no markup Stitch,
 * `rounded-lg` (visualmente 8px) deve corresponder a `raio.md`, e a chave
 * `lg` do Tailwind passa a apontar para `raio.lg` (12px) — não para o valor
 * default do Tailwind (0.5rem/8px). Ver README para a tabela de conversão
 * completa.
 */
const borderRadius = {
  none: px(raio.none),
  DEFAULT: px(raio.md),
  sm: px(raio.sm),
  md: px(raio.md),
  lg: px(raio.lg),
  xl: px(raio.xl),
  '2xl': px(raio.xxl),
  '3xl': px(raio.xxxl),
  full: px(raio.full),
};

const boxShadow: Record<string, string> = { ...elevacao };

/**
 * Preset Tailwind com os tokens do design system. Objeto plano
 * (`{ colors, fontSize, spacing, borderRadius, boxShadow }`) em vez do tipo
 * `Config['theme']['extend']` do Tailwind para não acoplar este pacote — sem
 * build step — a uma versão específica do Tailwind instalada só no app web
 * (Task C). Consumidor faz `presets: [preset]` (ou espalha `theme.extend`
 * manualmente, se a major do Tailwind mudar essa API).
 */
export const preset = {
  colors,
  fontSize,
  spacing,
  borderRadius,
  boxShadow,
};
