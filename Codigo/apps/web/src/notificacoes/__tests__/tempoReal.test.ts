import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATRASO_INICIAL,
  ATRASO_MAXIMO,
  deveFazerPolling,
  INTERVALO_PLANO_B_MS,
  proximoAtraso,
  rotuloAcessivelSino,
  rotuloContadorNotificacoes,
  urlDoSocket,
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

test('plano B consulta a cada 30 s', () => {
  assert.equal(INTERVALO_PLANO_B_MS, 30_000)
})

test('retentativa do socket: 2 s dobrando até o teto de 60 s', () => {
  assert.equal(ATRASO_INICIAL, 2_000)
  assert.equal(ATRASO_MAXIMO, 60_000)
  const sequencia = [ATRASO_INICIAL]
  for (let i = 0; i < 7; i += 1) sequencia.push(proximoAtraso(sequencia[sequencia.length - 1]))
  assert.deepEqual(sequencia, [2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000])
})

test('urlDoSocket: sem VITE_WS_URL conecta no próprio origin', () => {
  assert.equal(urlDoSocket({}), undefined)
  assert.equal(urlDoSocket({ VITE_WS_URL: undefined }), undefined)
  assert.equal(urlDoSocket({ VITE_WS_URL: '' }), undefined)
  assert.equal(urlDoSocket({ VITE_WS_URL: '   ' }), undefined)
})

test('urlDoSocket: com VITE_WS_URL usa a URL sem espaços nas pontas', () => {
  assert.equal(
    urlDoSocket({ VITE_WS_URL: 'https://montacontrol-api.onrender.com' }),
    'https://montacontrol-api.onrender.com',
  )
  assert.equal(
    urlDoSocket({ VITE_WS_URL: '  https://montacontrol-api-dev.onrender.com \n' }),
    'https://montacontrol-api-dev.onrender.com',
  )
})
