import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iniciais } from '../nomes.ts'

test('iniciais do primeiro e último nome', () => {
  assert.equal(iniciais('Ricardo Mendes'), 'RM')
  assert.equal(iniciais('Ana Paula de Souza'), 'AS')
  assert.equal(iniciais('ana'), 'AN')
  assert.equal(iniciais('   '), '?')
})
