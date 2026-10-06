import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAMANHO_MAXIMO_FOTO_BYTES, validarArquivoFoto } from '../fotos.ts'

test('aceita JPG e PNG até 5 MB', () => {
  assert.equal(validarArquivoFoto({ type: 'image/jpeg', size: 1024 }), null)
  assert.equal(validarArquivoFoto({ type: 'image/png', size: TAMANHO_MAXIMO_FOTO_BYTES }), null)
})

test('recusa outro formato ou arquivo grande', () => {
  assert.match(validarArquivoFoto({ type: 'image/heic', size: 1024 }) ?? '', /JPG ou PNG/)
  assert.match(validarArquivoFoto({ type: 'image/jpeg', size: TAMANHO_MAXIMO_FOTO_BYTES + 1 }) ?? '', /5 MB/)
})
