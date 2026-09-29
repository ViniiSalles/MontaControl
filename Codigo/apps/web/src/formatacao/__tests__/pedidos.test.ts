import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  converterRascunhoPedido,
  progressoDoPedido,
  validarRascunhoPedido,
} from '../pedidos.ts'

const rascunhoValido = {
  clienteId: 1,
  ambientes: [{ nome: 'Cozinha', itens: [{ descricao: 'Porta', quantidade: '2' }] }],
}

test('progresso do pedido', () => {
  assert.equal(progressoDoPedido({ quantidadeTotal: 3, quantidadeTriada: 1 }), '1/3')
  assert.equal(progressoDoPedido({ quantidadeTotal: 0, quantidadeTriada: 0 }), '0/0')
})

test('rascunho completo passa na validação', () => {
  assert.equal(validarRascunhoPedido(rascunhoValido), null)
})

test('validação cobra cliente, ambiente, nome, item, descrição e quantidade', () => {
  assert.match(validarRascunhoPedido({ ...rascunhoValido, clienteId: null }) ?? '', /cliente/i)
  assert.match(validarRascunhoPedido({ ...rascunhoValido, ambientes: [] }) ?? '', /ambiente/i)
  assert.match(
    validarRascunhoPedido({
      ...rascunhoValido,
      ambientes: [{ nome: '  ', itens: [{ descricao: 'X', quantidade: '1' }] }],
    }) ?? '',
    /nome/i,
  )
  assert.match(
    validarRascunhoPedido({ ...rascunhoValido, ambientes: [{ nome: 'Cozinha', itens: [] }] }) ?? '',
    /item/i,
  )
  assert.match(
    validarRascunhoPedido({
      ...rascunhoValido,
      ambientes: [{ nome: 'Cozinha', itens: [{ descricao: '', quantidade: '2' }] }],
    }) ?? '',
    /descrição/i,
  )
  assert.match(
    validarRascunhoPedido({
      ...rascunhoValido,
      ambientes: [{ nome: 'Cozinha', itens: [{ descricao: 'Porta', quantidade: '0' }] }],
    }) ?? '',
    /quantidade/i,
  )
  assert.match(
    validarRascunhoPedido({
      ...rascunhoValido,
      ambientes: [{ nome: 'Cozinha', itens: [{ descricao: 'Porta', quantidade: '1,5' }] }],
    }) ?? '',
    /quantidade/i,
  )
})

test('converte rascunho para o corpo da requisição, aparando espaços', () => {
  const corpo = converterRascunhoPedido({
    clienteId: 5,
    ambientes: [{ nome: ' Cozinha ', itens: [{ descricao: ' Porta 90cm ', quantidade: '3' }] }],
  })

  assert.deepEqual(corpo, {
    clienteId: 5,
    ambientes: [{ nome: 'Cozinha', itens: [{ descricao: 'Porta 90cm', quantidade: 3 }] }],
  })
})
