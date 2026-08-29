import { cores } from '../cores';

export interface NivelSombra {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/**
 * Especificações extraídas de `elevacao.ts` (web) — offset/blur/opacidade
 * em px, mesmos valores, re-tingidos nos mesmos tons (`cores.shadow`/
 * `cores.shadowBrand`).
 */
const especificacoes = {
  none: { offsetY: 0, blur: 0, opacidade: 0, cor: cores.shadow },
  elev1: { offsetY: 1, blur: 2, opacidade: 0.03, cor: cores.shadow },
  elev2: { offsetY: 4, blur: 20, opacidade: 0.04, cor: cores.shadow },
  elev3: { offsetY: 8, blur: 24, opacidade: 0.06, cor: cores.shadow },
  elev4: { offsetY: 12, blur: 32, opacidade: 0.08, cor: cores.shadow },
  nav: { offsetY: -8, blur: 24, opacidade: 0.08, cor: cores.shadow },
  marca: { offsetY: 8, blur: 20, opacidade: 0.3, cor: cores.shadowBrand },
} as const;

export type NivelSombraNome = keyof typeof especificacoes;

/**
 * Duas limitações honestas do Android (plano, risco R14), documentadas e
 * não contornadas com libs extras: `elevation` não tinge cor (`marca` sai
 * cinza, não azul) e ignora offset negativo (`nav` deveria subir, não
 * desce — por isso o `Math.max(offsetY, 0)` só no Android). iOS usa
 * `shadow*` completo, fiel ao token.
 *
 * `plataforma` é parâmetro explícito (não lê `Platform.OS` daqui dentro):
 * `design-tokens` não depende de `react-native` — é TS puro, consumível
 * por qualquer ambiente (inclusive o smoke test deste pacote, que roda via
 * `tsx` puro, fora de qualquer runtime RN). O app mobile passa
 * `Platform.OS` na chamada.
 */
export function sombraPorNivel(nivel: NivelSombraNome, plataforma: 'ios' | 'android'): NivelSombra {
  const spec = especificacoes[nivel];
  return {
    shadowColor: spec.cor,
    shadowOffset: {
      width: 0,
      height: plataforma === 'android' ? Math.max(spec.offsetY, 0) : spec.offsetY,
    },
    shadowOpacity: spec.opacidade,
    shadowRadius: spec.blur / 2,
    elevation: plataforma === 'android' ? Math.round(spec.blur / 2) : 0,
  };
}
