/**
 * Escala de raio de borda (px). `md` é o raio padrão do design system
 * (DESIGN.md §6: "use 8px (DEFAULT) rounding for almost all containers").
 * `2xl`/`3xl` não são identificadores JS válidos — usa-se `xxl`/`xxxl`.
 */
export const raio = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  xxxl: 32,
  full: 9999,
} as const;
