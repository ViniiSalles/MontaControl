/**
 * Regenera `src/ui/icones-svg/dados.ts` a partir de `NOMES_ICONE`
 * (@montacontrol/design-tokens/icones). `base` = SVG outlined, `fill` = a
 * variante `-fill` do mesmo ícone, ambos do pacote @material-symbols/svg-400.
 *
 * Uso (a partir de Codigo/): pnpm --filter @montacontrol/mobile gerar:icones
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { NOMES_ICONE } from '@montacontrol/design-tokens/icones';

const require = createRequire(import.meta.url);
const pastaOutlined = resolve(
  dirname(require.resolve('@material-symbols/svg-400/package.json')),
  'outlined',
);
const destino = resolve(import.meta.dirname, '../src/ui/icones-svg/dados.ts');

const ler = (arquivo: string) => readFileSync(resolve(pastaOutlined, arquivo), 'utf8').trim();

const linhas = NOMES_ICONE.map(
  (nome) =>
    `  ${JSON.stringify(nome)}: { base: ${JSON.stringify(ler(`${nome}.svg`))}, fill: ${JSON.stringify(ler(`${nome}-fill.svg`))} },`,
);

writeFileSync(
  destino,
  [
    '// Gerado por scripts/gerar-icones.ts a partir de @material-symbols/svg-400/outlined.',
    '// Não editar à mão: inclua o nome em NOMES_ICONE (design-tokens/icones.ts) e rode `pnpm --filter @montacontrol/mobile gerar:icones`.',
    "import type { NomeIcone } from '@montacontrol/design-tokens/icones';",
    '',
    'export const dadosSvgPorIcone: Record<NomeIcone, { base: string; fill: string }> = {',
    ...linhas,
    '};',
    '',
  ].join('\n'),
);
console.log(`dados.ts regenerado com ${NOMES_ICONE.length} ícones.`);
