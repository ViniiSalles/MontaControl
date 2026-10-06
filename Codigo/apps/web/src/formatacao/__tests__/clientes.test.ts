import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  RASCUNHO_VAZIO,
  linkMapa,
  mascararCep,
  mascararTelefone,
  validarRascunhoCliente,
} from '../clientes.ts'

const valido = {
  nome: ' Maria Souza ',
  cep: '30130100',
  endereco: 'Rua das Flores, 100',
  cidade: 'Belo Horizonte',
  estado: 'MG',
  telefone: '(31) 99999-8888',
  latitude: '-19,93',
  longitude: '-43.93',
}

test('máscaras de CEP e telefone', () => {
  assert.equal(mascararCep('30130100'), '30130-100')
  assert.equal(mascararCep('301'), '301')
  assert.equal(mascararTelefone('31999998888'), '(31) 99999-8888')
  assert.equal(mascararTelefone('3133334444'), '(31) 3333-4444')
})

test('rascunho válido vira corpo da API, aceitando vírgula decimal', () => {
  const { dados } = validarRascunhoCliente(valido)
  assert.deepEqual(dados, {
    nome: 'Maria Souza',
    cep: '30130-100',
    endereco: 'Rua das Flores, 100',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    telefone: '31999998888',
    latitude: -19.93,
    longitude: -43.93,
  })
})

test('rascunho vazio aponta todos os campos', () => {
  const { erros, dados } = validarRascunhoCliente(RASCUNHO_VAZIO)
  assert.equal(dados, null)
  assert.deepEqual(Object.keys(erros).sort(), [
    'cep',
    'cidade',
    'endereco',
    'estado',
    'latitude',
    'longitude',
    'nome',
    'telefone',
  ])
})

test('coordenada fora da faixa é recusada', () => {
  assert.ok(validarRascunhoCliente({ ...valido, latitude: '95' }).erros.latitude)
})

test('link do mapa só com coordenadas válidas', () => {
  assert.match(linkMapa('-19.9', '-43.9') ?? '', /mlat=-19.9&mlon=-43.9/)
  assert.equal(linkMapa('', '-43.9'), null)
})
