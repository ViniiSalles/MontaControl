import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ordenarLinhas, proximaOrdem, rotuloDirecao } from '../ordenacao.ts'

interface Linha {
  nome: string
  saldo: number | null
  enviadoEm: string
}

const linhas: Linha[] = [
  { nome: 'Érica', saldo: -2, enviadoEm: '2026-10-03T10:00:00.000Z' },
  { nome: 'ana', saldo: 5, enviadoEm: '2026-10-01T10:00:00.000Z' },
  { nome: 'Bruno', saldo: null, enviadoEm: '2026-10-02T10:00:00.000Z' },
  { nome: 'Peça 10', saldo: 0, enviadoEm: '2026-09-30T10:00:00.000Z' },
  { nome: 'Peça 2', saldo: 1, enviadoEm: '2026-09-29T10:00:00.000Z' },
]

const colunas = [
  { titulo: 'Nome', ordenacao: { tipo: 'texto' as const, valor: (l: Linha) => l.nome } },
  { titulo: 'Saldo', ordenacao: { tipo: 'numero' as const, valor: (l: Linha) => l.saldo } },
  { titulo: 'Envio', ordenacao: { tipo: 'data' as const, valor: (l: Linha) => l.enviadoEm } },
  { titulo: 'Ações' },
]

const nomes = (lista: Linha[]) => lista.map((linha) => linha.nome)

test('texto ignora acento e caixa e ordena números dentro do texto', () => {
  assert.deepEqual(nomes(ordenarLinhas(linhas, colunas, { coluna: 'Nome', direcao: 'asc' })), [
    'ana',
    'Bruno',
    'Érica',
    'Peça 2',
    'Peça 10',
  ])
  assert.deepEqual(nomes(ordenarLinhas(linhas, colunas, { coluna: 'Nome', direcao: 'desc' })), [
    'Peça 10',
    'Peça 2',
    'Érica',
    'Bruno',
    'ana',
  ])
})

test('número compara o valor cru e vazio fica no fim nas duas direções', () => {
  assert.deepEqual(
    ordenarLinhas(linhas, colunas, { coluna: 'Saldo', direcao: 'asc' }).map((l) => l.saldo),
    [-2, 0, 1, 5, null],
  )
  assert.deepEqual(
    ordenarLinhas(linhas, colunas, { coluna: 'Saldo', direcao: 'desc' }).map((l) => l.saldo),
    [5, 1, 0, -2, null],
  )
})

test('data ordena cronologicamente', () => {
  assert.deepEqual(nomes(ordenarLinhas(linhas, colunas, { coluna: 'Envio', direcao: 'desc' })), [
    'Érica',
    'Bruno',
    'ana',
    'Peça 10',
    'Peça 2',
  ])
})

test('sem ordem, ou coluna sem ordenação, devolve a lista original sem mutar', () => {
  assert.equal(ordenarLinhas(linhas, colunas, null), linhas)
  assert.equal(ordenarLinhas(linhas, colunas, { coluna: 'Ações', direcao: 'asc' }), linhas)
  ordenarLinhas(linhas, colunas, { coluna: 'Nome', direcao: 'asc' })
  assert.equal(linhas[0].nome, 'Érica')
})

test('clique alterna crescente, decrescente e volta ao original', () => {
  const primeira = proximaOrdem(null, 'Nome')
  assert.deepEqual(primeira, { coluna: 'Nome', direcao: 'asc' })
  const segunda = proximaOrdem(primeira, 'Nome')
  assert.deepEqual(segunda, { coluna: 'Nome', direcao: 'desc' })
  assert.equal(proximaOrdem(segunda, 'Nome'), null)
  assert.deepEqual(proximaOrdem(segunda, 'Saldo'), { coluna: 'Saldo', direcao: 'asc' })
})

test('rótulos por tipo', () => {
  assert.equal(rotuloDirecao('texto', 'asc'), 'A–Z')
  assert.equal(rotuloDirecao('data', 'desc'), 'mais recente primeiro')
})
