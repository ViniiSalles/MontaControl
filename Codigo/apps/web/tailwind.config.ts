import type { Config } from 'tailwindcss';
import { preset } from '@montacontrol/design-tokens/web/preset';

// 'Inter Variable' é o nome de família registrado pelo self-hosting
// (@fontsource-variable/inter, ver src/main.tsx) — a mesma fonte que
// `@montacontrol/design-tokens/fontes` descreve como 'Inter', carregada de
// forma diferente por T11.2 (variável no web) do que no Mobile (faces
// estáticas, ver fontes.ts).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      ...preset,
      fontFamily: {
        sans: ['Inter Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
} satisfies Config;
