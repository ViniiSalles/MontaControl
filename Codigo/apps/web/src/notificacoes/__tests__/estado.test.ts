import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NotificacaoDTO } from '@montacontrol/shared'
import {
  anexarPagina,
  aplicarLista,
  aplicarNova,
  marcarLidaNoEstado,
  marcarTodasNoEstado,
} from '../estado.ts'

function notificacao(sobrescritas: Partial<NotificacaoDTO>): NotificacaoDTO {
  return {
    id: 1,
    tipo: 'AVARIA_REPORTADA',
    titulo: 'Avaria reportada',
    mensagem: 'Peça danificada no pedido PED-1',
    referenciaTipo: 'AVARIA',
    referenciaId: 10,
    lida: false,
    criadaEm: '2026-10-27T12:00:00.000Z',
    ...sobrescritas,
  }
}

test('aplicarLista copia itens e contagem de não lidas do servidor', () => {
  const itens = [notificacao({ id: 2 }), notificacao({ id: 1, lida: true })]
  const estado = aplicarLista({ itens, naoLidas: 7, proximoCursor: 1 })
  assert.deepEqual(estado.itens, itens)
  assert.equal(estado.naoLidas, 7)
})

test('aplicarNova ignora id repetido', () => {
  const inicial = { itens: [notificacao({ id: 5 })], naoLidas: 1 }
  const estado = aplicarNova(inicial, notificacao({ id: 5 }))
  assert.equal(estado, inicial)
})

test('aplicarNova coloca a notificação no topo da lista', () => {
  const inicial = { itens: [notificacao({ id: 5 })], naoLidas: 1 }
  const estado = aplicarNova(inicial, notificacao({ id: 6 }))
  assert.deepEqual(
    estado.itens.map((n) => n.id),
    [6, 5],
  )
})

test('aplicarNova incrementa naoLidas só para não lida', () => {
  const inicial = { itens: [], naoLidas: 2 }
  assert.equal(aplicarNova(inicial, notificacao({ id: 1, lida: false })).naoLidas, 3)
  assert.equal(aplicarNova(inicial, notificacao({ id: 2, lida: true })).naoLidas, 2)
})

test('marcarLidaNoEstado marca a notificação e decrementa naoLidas', () => {
  const inicial = { itens: [notificacao({ id: 1 }), notificacao({ id: 2 })], naoLidas: 2 }
  const estado = marcarLidaNoEstado(inicial, 1)
  assert.equal(estado.itens[0].lida, true)
  assert.equal(estado.itens[1].lida, false)
  assert.equal(estado.naoLidas, 1)
})

test('marcarLidaNoEstado não decrementa se já estava lida ou id desconhecido', () => {
  const inicial = { itens: [notificacao({ id: 1, lida: true })], naoLidas: 3 }
  assert.equal(marcarLidaNoEstado(inicial, 1), inicial)
  assert.equal(marcarLidaNoEstado(inicial, 99), inicial)
})

test('marcarTodasNoEstado zera naoLidas', () => {
  const inicial = { itens: [notificacao({ id: 1 }), notificacao({ id: 2 })], naoLidas: 9 }
  const estado = marcarTodasNoEstado(inicial)
  assert.equal(estado.naoLidas, 0)
  assert.ok(estado.itens.every((n) => n.lida))
})

test('anexarPagina acrescenta ao fim sem repetir ids e adota naoLidas do servidor', () => {
  const inicial = { itens: [notificacao({ id: 3 }), notificacao({ id: 2 })], naoLidas: 2 }
  const estado = anexarPagina(inicial, {
    itens: [notificacao({ id: 2 }), notificacao({ id: 1 })],
    naoLidas: 4,
    proximoCursor: null,
  })
  assert.deepEqual(
    estado.itens.map((n) => n.id),
    [3, 2, 1],
  )
  assert.equal(estado.naoLidas, 4)
})
