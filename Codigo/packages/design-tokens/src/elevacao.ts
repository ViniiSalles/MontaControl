/**
 * Sombras (`box-shadow`), só para web por ora — o adaptador `native/`
 * (RN 0.74 não tem `boxShadow` nem spread; vai precisar emitir
 * `shadowColor`/`shadowRadius`/`elevation` por plataforma, com duas
 * limitações honestas no Android: offset negativo de `nav` é ignorado, e
 * `marca` sai cinza porque elevation não tinge) fica para quando a Fase
 * 8/9 (mobile) começar.
 *
 * Escala e valores exatos vêm do plano (seção "Elevação"), re-tingidos em
 * `#001b3d` (= cores.shadow); `marca` usa `#004d99` (= cores.shadowBrand).
 * `elev4` é a spec §4 do DESIGN.md verbatim (sombra ambiente de modais).
 */
export const elevacao = {
  none: 'none',
  elev1: '0 1px 2px 0 rgba(0,27,61,0.03)',
  // Canônico para cards (18 ocorrências no levantamento do mockup).
  elev2: '0 4px 20px -4px rgba(0,27,61,0.04)',
  elev3: '0 8px 24px -4px rgba(0,27,61,0.06)',
  elev4: '0 12px 32px -4px rgba(0,27,61,0.08)',
  // Barra de navegação inferior (mobile).
  nav: '0 -8px 24px 0 rgba(0,27,61,0.08)',
  // Glow de marca — CTAs primários e indicadores "ao vivo" (Activity Pulse).
  marca: '0 8px 20px -4px rgba(0,77,153,0.3)',
} as const;
