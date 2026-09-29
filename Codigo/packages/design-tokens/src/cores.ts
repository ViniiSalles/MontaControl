/**
 * Paleta de cores (papéis semânticos Material 3), transcrita byte-exata de
 * `stitch_tcc/login_montacontrol/code.html` (config Tailwind inline do mockup).
 */
export const cores = {
  primary: '#004d99',
  onPrimary: '#ffffff',
  primaryContainer: '#1565c0',
  onPrimaryContainer: '#dae5ff',
  primaryFixed: '#d6e3ff',
  primaryFixedDim: '#a9c7ff',
  onPrimaryFixed: '#001b3d',
  onPrimaryFixedVariant: '#00468c',
  inversePrimary: '#a9c7ff',

  secondary: '#4a5f83',
  onSecondary: '#ffffff',
  secondaryContainer: '#c0d5ff',
  onSecondaryContainer: '#475c80',
  secondaryFixed: '#d6e3ff',
  secondaryFixedDim: '#b2c7f1',
  onSecondaryFixed: '#021b3c',
  onSecondaryFixedVariant: '#32476a',

  tertiary: '#813900',
  onTertiary: '#ffffff',
  tertiaryContainer: '#a64c00',
  onTertiaryContainer: '#ffdece',
  tertiaryFixed: '#ffdbc9',
  tertiaryFixedDim: '#ffb68c',
  onTertiaryFixed: '#321200',
  onTertiaryFixedVariant: '#753400',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  background: '#f9f9f9',
  onBackground: '#1a1c1c',
  surface: '#f9f9f9',
  onSurface: '#1a1c1c',
  surfaceVariant: '#e2e2e2',
  onSurfaceVariant: '#424752',
  surfaceTint: '#005db7',

  surfaceDim: '#dadada',
  surfaceBright: '#f9f9f9',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f3f3f3',
  surfaceContainer: '#eeeeee',
  surfaceContainerHigh: '#e8e8e8',
  surfaceContainerHighest: '#e2e2e2',

  inverseSurface: '#2f3131',
  inverseOnSurface: '#f1f1f1',

  outline: '#727783',
  outlineVariant: '#c2c6d4',

  // Papéis adicionais (não existem no config Tailwind do mockup, adicionados
  // conforme seção "Demais tokens" do plano — badges de status/feedback).
  success: '#146c2e',
  onSuccess: '#ffffff',
  successContainer: '#a4f4ab',
  onSuccessContainer: '#00390f',

  // Sidebar "âncora" (DESIGN.md §4, "The Dark Sidebar acts as the Anchor").
  // Transcritos do code.html das telas web do Stitch: bg-[#1E1E2D],
  // text-slate-400 (itens), text-slate-500 (subtítulo), border-slate-800.
  ancora: '#1e1e2d',
  onAncora: '#ffffff',
  onAncoraVariant: '#94a3b8',
  onAncoraApagado: '#64748b',
  ancoraDivisor: '#1e293b',

  // `scrim`: overlay usado atrás de modais/drawers (glassmorphism). O valor é
  // só a cor — opacidade (40%) e blur (4px) são decisão de uso do
  // componente/preset consumidor, não ficam embutidos no token.
  scrim: '#1a1c1c',
  // Tons usados para tingir `box-shadow` (ver elevacao.ts) — mantidos aqui
  // como papéis nomeados porque também aparecem como cor de texto/ícone em
  // outros contextos, não só em sombra.
  shadow: '#001b3d',
  shadowBrand: '#004d99',
} as const;
