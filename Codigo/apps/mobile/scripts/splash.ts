/**
 * Geometria e renderização da imagem da splash nativa. É a mesma marca do
 * Login (`src/telas/Login.tsx`): tile 64 em `primaryContainer`, raio `lg`,
 * ícone `conveyor_belt` (outlined) a metade do tile em `onPrimaryContainer`.
 * Aqui só muda a escala — tudo vem dos tokens, nada de hex solto.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { cores } from '@montacontrol/design-tokens/cores';
import { espacamento } from '@montacontrol/design-tokens/espacamento';
import { raio } from '@montacontrol/design-tokens/raio';

/** Lado do PNG. O Android 12+ recorta a splash num círculo, então a marca fica bem no centro. */
export const LADO_SPLASH = 1024;

const LADO_TILE = LADO_SPLASH / 2;
const RAIO_TILE = (LADO_TILE * raio.lg) / espacamento[64];
const LADO_ICONE = LADO_TILE / 2;

const arquivoIcone = resolve(
  dirname(require.resolve('@material-symbols/svg-400/package.json')),
  'outlined',
  'conveyor_belt.svg',
);

/** Conteúdo (paths) do SVG do Material Symbols, sem a tag `<svg>` externa. */
function caminhosDoIcone(): string {
  const bruto = readFileSync(arquivoIcone, 'utf8');
  const interno = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(bruto)?.[1];
  if (!interno) throw new Error(`SVG inesperado em ${arquivoIcone}`);
  return interno;
}

export function montarSvgSplash(): string {
  const origemTile = (LADO_SPLASH - LADO_TILE) / 2;
  const origemIcone = (LADO_SPLASH - LADO_ICONE) / 2;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO_SPLASH}" height="${LADO_SPLASH}" viewBox="0 0 ${LADO_SPLASH} ${LADO_SPLASH}">`,
    `<rect x="${origemTile}" y="${origemTile}" width="${LADO_TILE}" height="${LADO_TILE}" rx="${RAIO_TILE}" fill="${cores.primaryContainer}"/>`,
    `<svg x="${origemIcone}" y="${origemIcone}" width="${LADO_ICONE}" height="${LADO_ICONE}" viewBox="0 -960 960 960" fill="${cores.onPrimaryContainer}">${caminhosDoIcone()}</svg>`,
    '</svg>',
  ].join('');
}

export function rasterizarSplash() {
  return new Resvg(montarSvgSplash()).render();
}

export function renderizarSplash(): Buffer {
  return rasterizarSplash().asPng();
}
