import assert from 'node:assert/strict';
import * as barril from '../src/index';
import { cores } from '../src/cores';
import { tipografia } from '../src/tipografia';
import { espacamento, espacamentoNomeado } from '../src/espacamento';
import { raio } from '../src/raio';
import { elevacao } from '../src/elevacao';
import { fontes } from '../src/fontes';
import { preset } from '../src/web/preset';
import { variaveisCss, variaveisCssTexto } from '../src/web/variaveis';
import { estiloTexto, tipografia as tipografiaNative } from '../src/native/texto';
import { sombraPorNivel } from '../src/native/sombra';
import { NOMES_ICONE } from '../src/icones';

const hex = /^#[0-9a-f]{6}$/i;

// cores: toda entrada é um hex válido de 6 dígitos.
for (const [chave, valor] of Object.entries(cores)) {
  assert.match(valor, hex, `cores.${chave} não é um hex válido: ${valor}`);
}

// tipografia: cada token tem os 4 campos com tipos esperados.
for (const [chave, token] of Object.entries(tipografia)) {
  assert.equal(typeof token.px, 'number', `tipografia.${chave}.px`);
  assert.equal(typeof token.lineHeight, 'number', `tipografia.${chave}.lineHeight`);
  assert.equal(typeof token.peso, 'number', `tipografia.${chave}.peso`);
  assert.equal(typeof token.tracking, 'string', `tipografia.${chave}.tracking`);
}

assert.equal(espacamento[16], 16);
assert.equal(espacamentoNomeado.alturaCampo, 56);
assert.equal(raio.md, 8);
assert.equal(raio.lg, 12);
assert.equal(elevacao.elev4.includes('rgba'), true);
assert.equal(elevacao.elev4, '0 12px 32px -4px rgba(0,27,61,0.08)');
assert.deepEqual(fontes.familia, 'Inter');

// preset.ts: objeto Tailwind-shaped com as chaves top-level esperadas.
for (const chave of ['colors', 'fontSize', 'spacing', 'borderRadius', 'boxShadow'] as const) {
  assert.equal(typeof preset[chave], 'object', `preset.${chave} deveria ser um objeto`);
  assert.ok(preset[chave] !== null, `preset.${chave} não pode ser null`);
}
assert.equal(preset.colors['primary-container'], cores.primaryContainer);
// remapeamento deliberado: chave Tailwind "lg" -> raio.lg (12), não o
// default do Tailwind (8px) — ver README.
assert.equal(preset.borderRadius.lg, '12px');
assert.equal(preset.borderRadius.DEFAULT, '8px');

// variaveis.ts
assert.equal(variaveisCss['--cor-primary'], cores.primary);
assert.ok(variaveisCssTexto.startsWith(':root {'));

// index.ts (barril de compatibilidade main/types/react-native): reexporta
// os módulos neutros, não os adaptadores web/native.
assert.equal(barril.cores.primary, cores.primary);
assert.equal(typeof barril.tipografia, 'object');
assert.equal(typeof barril.raio, 'object');

// native/texto.ts: nunca emite fontWeight, sempre fontFamily por peso.
const estiloBotao = estiloTexto(tipografiaNative.titleLg);
assert.equal(estiloBotao.fontFamily, 'Inter_700Bold');
assert.equal('fontWeight' in estiloBotao, false, 'estiloTexto não deve emitir fontWeight (R13)');
assert.equal(estiloTexto(tipografiaNative.bodyMd, 800).fontFamily, 'Inter_800ExtraBold');

// native/sombra.ts: elev4 tem os mesmos offset/blur do valor web, em ambas as plataformas.
const elev4Ios = sombraPorNivel('elev4', 'ios');
assert.equal(elev4Ios.shadowOffset.height, 12);
assert.equal(elev4Ios.shadowRadius, 16);
assert.equal(elev4Ios.elevation, 0, 'iOS não usa elevation');

// nav: as duas limitações do Android (R14) — offset negativo vira 0, elevation > 0.
const navIos = sombraPorNivel('nav', 'ios');
assert.equal(navIos.shadowOffset.height, -8, 'iOS preserva o offset negativo');
const navAndroid = sombraPorNivel('nav', 'android');
assert.equal(navAndroid.shadowOffset.height, 0, 'Android não faz offset negativo — vira 0 (R14)');
assert.ok(navAndroid.elevation > 0, 'Android usa elevation, não shadow*');

console.log('OK — native/ (texto, sombra) smoke test passou.');

// Sidebar "âncora" (DESIGN.md §4) — valores do code.html do Stitch.
assert.equal(cores.ancora, '#1e1e2d');
assert.equal(preset.colors.ancora, cores.ancora);
assert.equal(preset.colors['on-ancora-variant'], cores.onAncoraVariant);
assert.equal(espacamentoNomeado.larguraBarraLateral, 256);
assert.equal(espacamentoNomeado.larguraPainelLateral, 440);
assert.equal(espacamentoNomeado.alturaGrafico, 160);

// Ícones: lista em runtime (gerador do mobile) sem duplicatas.
assert.equal(new Set(NOMES_ICONE).size, NOMES_ICONE.length);
assert.ok(NOMES_ICONE.includes('pending_actions'));

console.log('OK — @montacontrol/design-tokens smoke test passou.');
