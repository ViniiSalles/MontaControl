import { tipografia } from '../tipografia';
import type { TipografiaToken } from '../tipos';

/**
 * Android descarta `fontWeight` em fontes customizadas (plano, risco R13) —
 * cada peso carrega uma família Inter já cortada nesse peso
 * (`Inter_700Bold`), nunca `fontWeight` numérico. Nomes batem com os
 * carregados em `apps/mobile/App.tsx` (Task 3).
 */
const familiaPorPeso: Record<number, string> = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
};

export interface EstiloTexto {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontVariant?: ['tabular-nums'];
}

/** `tracking` de tipografia.ts vem em `em` (ex. "-0.02em"); RN quer px absoluto. */
function trackingParaPx(tracking: string, px: number): number {
  return Number.parseFloat(tracking) * px;
}

export function estiloTexto(token: TipografiaToken, pesoCustom?: number, tabular?: boolean): EstiloTexto {
  const peso = pesoCustom ?? token.peso;
  const familia = familiaPorPeso[peso];
  if (!familia) {
    throw new Error(`Peso ${peso} sem família Inter carregada — ver familiaPorPeso em native/texto.ts`);
  }
  return {
    fontFamily: familia,
    fontSize: token.px,
    lineHeight: token.lineHeight,
    letterSpacing: trackingParaPx(token.tracking, token.px),
    ...(tabular ? { fontVariant: ['tabular-nums'] as const } : {}),
  };
}

export { tipografia, familiaPorPeso };
