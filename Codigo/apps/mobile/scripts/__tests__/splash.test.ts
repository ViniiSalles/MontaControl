import { cores } from '@montacontrol/design-tokens/cores';
import { LADO_SPLASH, montarSvgSplash, rasterizarSplash, renderizarSplash } from '../splash';

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

describe('splash da marca', () => {
  test('o SVG usa só cores dos tokens: tile em primaryContainer e ícone em onPrimaryContainer', () => {
    const svg = montarSvgSplash();

    expect(svg).toContain(cores.primaryContainer);
    expect(svg).toContain(cores.onPrimaryContainer);
  });

  test('a imagem é quadrada, com o lado esperado', () => {
    const { width, height } = rasterizarSplash();

    expect([width, height]).toEqual([LADO_SPLASH, LADO_SPLASH]);
  });

  test('o fundo é transparente (a cor de fundo vem do app.json) e o tile tem a cor da marca', () => {
    const { width, pixels } = rasterizarSplash();
    const pixelEm = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
    };

    expect(pixelEm(5, 5).a).toBe(0);

    // Dentro do tile, longe do ícone e dos cantos arredondados.
    const tile = pixelEm(LADO_SPLASH / 2 - 200, LADO_SPLASH / 2 - 200);
    expect(tile.a).toBe(255);
    expect(hex(tile.r, tile.g, tile.b)).toBe(cores.primaryContainer);
  });

  test('o PNG gerado tem a assinatura PNG', () => {
    expect(renderizarSplash().subarray(0, 4).toString('hex')).toBe('89504e47');
  });
});
