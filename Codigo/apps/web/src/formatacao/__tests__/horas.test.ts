import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatarMinutos, horasParaMinutos } from '../horas.ts'

test('minutos em HH:mm, horas podem passar de 24', () => {
  assert.equal(formatarMinutos(9865), '164:25')
  assert.equal(formatarMinutos(5), '00:05')
  assert.equal(formatarMinutos(0), '00:00')
})

test('com sinal explícito', () => {
  assert.equal(formatarMinutos(768, true), '+12:48')
  assert.equal(formatarMinutos(-260, true), '-04:20')
  assert.equal(formatarMinutos(0, true), '00:00')
})

test('sem sinal pedido, negativo ainda mostra "-"', () => {
  assert.equal(formatarMinutos(-30), '-00:30')
})

test('horas decimais em minutos', () => {
  assert.equal(horasParaMinutos(42.25), 2535)
  assert.equal(horasParaMinutos(-4.33), -260)
})
