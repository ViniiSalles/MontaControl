import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deveFazerPolling,
  rotuloAcessivelSino,
  rotuloContadorNotificacoes,
} from '../tempoReal.ts'

test('contador: zero não mostra selo', () => {
  assert.equal(rotuloContadorNotificacoes(0), null)
})

test('contador: de 1 a 9 mostra o número', () => {
  assert.equal(rotuloContadorNotificacoes(1), '1')
  assert.equal(rotuloContadorNotificacoes(9), '9')
})

test('contador: acima de 9 é limitado a 9+', () => {
  assert.equal(rotuloContadorNotificacoes(10), '9+')
  assert.equal(rotuloContadorNotificacoes(250), '9+')
})

test('rótulo acessível do sino conta as não lidas por extenso (sem o limite 9+)', () => {
  assert.equal(rotuloAcessivelSino(0), 'Notificações, nenhuma não lida')
  assert.equal(rotuloAcessivelSino(1), 'Notificações, 1 não lida')
  assert.equal(rotuloAcessivelSino(12), 'Notificações, 12 não lidas')
})

test('o dashboard só faz polling com o socket caído', () => {
  assert.equal(deveFazerPolling(false), true)
  assert.equal(deveFazerPolling(true), false)
})
