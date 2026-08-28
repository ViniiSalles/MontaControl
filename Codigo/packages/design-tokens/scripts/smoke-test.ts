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

console.log('OK — @montacontrol/design-tokens smoke test passou.');
