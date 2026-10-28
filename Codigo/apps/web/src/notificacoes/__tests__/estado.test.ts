import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NotificacaoDTO } from '@montacontrol/shared'
import {
  anexarPagina,
  aplicarLista,
  aplicarNova,
  desmarcarLidasNoEstado,
  marcarLidaNoEstado,
  mesclarLista,
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

test('mesclarLista mantém notificação ao vivo que chegou durante o fetch', () => {
  // Estado local já tem a 11 (evento) enquanto a resposta é um snapshot anterior a ela.
  const atual = { itens: [notificacao({ id: 11 }), notificacao({ id: 10 })], naoLidas: 2 }
  const estado = mesclarLista(atual, {
    itens: [notificacao({ id: 10 }), notificacao({ id: 9 })],
    naoLidas: 2,
    proximoCursor: null,
  })
  assert.deepEqual(
    estado.itens.map((n) => n.id),
    [11, 10, 9],
  )
  assert.equal(estado.naoLidas, 3)
})

test('mesclarLista não conta duas vezes o item que já está na resposta', () => {
  const atual = { itens: [notificacao({ id: 10 })], naoLidas: 1 }
  const estado = mesclarLista(atual, {
    itens: [notificacao({ id: 10 }), notificacao({ id: 9 })],
    naoLidas: 2,
    proximoCursor: null,
  })
  assert.equal(estado.itens.length, 2)
  assert.equal(estado.naoLidas, 2)
})

test('mesclarLista mantém lida a notificação marcada localmente após snapshot antigo', () => {
  const atual = { itens: [notificacao({ id: 2, lida: true }), notificacao({ id: 1 })], naoLidas: 1 }
  const estado = mesclarLista(
    atual,
    {
      itens: [notificacao({ id: 2, lida: false }), notificacao({ id: 1, lida: false })],
      naoLidas: 2,
      proximoCursor: null,
    },
    { ids: new Set([2]), todas: false },
  )
  assert.equal(estado.itens.find((n) => n.id === 2)?.lida, true)
  assert.equal(estado.itens.find((n) => n.id === 1)?.lida, false)
  assert.equal(estado.naoLidas, 1)
})

test('mesclarLista: com "marcar todas" pendente, tudo lido localmente segue lido', () => {
  const atual = {
    itens: [notificacao({ id: 2, lida: true }), notificacao({ id: 1, lida: true })],
    naoLidas: 0,
  }
  const estado = mesclarLista(
    atual,
    { itens: [notificacao({ id: 2 }), notificacao({ id: 1 })], naoLidas: 2, proximoCursor: null },
    { ids: new Set(), todas: true },
  )
  assert.ok(estado.itens.every((n) => n.lida))
  assert.equal(estado.naoLidas, 0)
})

test('mesclarLista: id não pendente adota o lida do servidor (rollback de PATCH que falhou)', () => {
  // PATCH falhou, a pendência já foi liberada e a UI ainda mostra o item como lido.
  const atual = { itens: [notificacao({ id: 2, lida: true }), notificacao({ id: 1 })], naoLidas: 1 }
  const estado = mesclarLista(atual, {
    itens: [notificacao({ id: 2 }), notificacao({ id: 1 })],
    naoLidas: 2,
    proximoCursor: null,
  })
  assert.equal(estado.itens.find((n) => n.id === 2)?.lida, false)
  assert.equal(estado.naoLidas, 2)
})

test('desmarcarLidasNoEstado volta a não lida e devolve a contagem', () => {
  const inicial = {
    itens: [notificacao({ id: 2, lida: true }), notificacao({ id: 1, lida: true })],
    naoLidas: 0,
  }
  const estado = desmarcarLidasNoEstado(inicial, [2])
  assert.equal(estado.itens.find((n) => n.id === 2)?.lida, false)
  assert.equal(estado.itens.find((n) => n.id === 1)?.lida, true)
  assert.equal(estado.naoLidas, 1)
})

test('desmarcarLidasNoEstado ignora id desconhecido ou já não lido', () => {
  const inicial = { itens: [notificacao({ id: 1 })], naoLidas: 1 }
  assert.equal(desmarcarLidasNoEstado(inicial, [1, 99]), inicial)
})

test('mesclarLista com snapshot mais antigo preserva item ao vivo e leitura pendente', () => {
  const resposta2 = {
    itens: [notificacao({ id: 10 }), notificacao({ id: 9, lida: true })],
    naoLidas: 1,
    proximoCursor: null,
  }
  const resposta1Antiga = {
    itens: [notificacao({ id: 9, lida: false }), notificacao({ id: 8 })],
    naoLidas: 2,
    proximoCursor: null,
  }
  const depoisDaNova = mesclarLista({ itens: [], naoLidas: 0 }, resposta2)
  const estado = mesclarLista(depoisDaNova, resposta1Antiga, { ids: new Set([9]), todas: false })
  assert.deepEqual(
    estado.itens.map((n) => n.id),
    [10, 9, 8],
  )
  assert.equal(estado.itens.find((n) => n.id === 9)?.lida, true)
  assert.equal(estado.naoLidas, 2)
})

test('mesclarLista com resposta vazia preserva o que chegou ao vivo', () => {
  const atual = { itens: [notificacao({ id: 1 })], naoLidas: 1 }
  const estado = mesclarLista(atual, { itens: [], naoLidas: 0, proximoCursor: null })
  assert.equal(estado.itens.length, 1)
  assert.equal(estado.naoLidas, 1)
})
