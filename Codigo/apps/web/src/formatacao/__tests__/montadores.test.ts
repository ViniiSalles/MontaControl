import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { UsuarioDTO } from '@montacontrol/shared'
import { Perfil } from '@montacontrol/shared'
import { contarNovosNoMes, filtrarMontadores, formatarDataCadastro } from '../montadores.ts'

function montador(parcial: Partial<UsuarioDTO>): UsuarioDTO {
  return { id: 1, nome: 'Ana Souza', email: 'ana@x.com', perfil: Perfil.MONTADOR, ativo: true, ...parcial }
}

test('busca por nome, e-mail e CPF (só dígitos)', () => {
  const lista = [
    montador({ id: 1, nome: 'Ana Souza', cpf: '52998224725' }),
    montador({ id: 2, nome: 'Beto Lima', email: 'beto@x.com', cpf: '11144477735' }),
  ]
  assert.deepEqual(filtrarMontadores(lista, 'ana').map((m) => m.id), [1])
  assert.deepEqual(filtrarMontadores(lista, 'BETO@').map((m) => m.id), [2])
  assert.deepEqual(filtrarMontadores(lista, '111.444').map((m) => m.id), [2])
  assert.deepEqual(filtrarMontadores(lista, '').map((m) => m.id), [1, 2])
})

test('novos no mês pelo criadoEm', () => {
  const agora = new Date(2026, 8, 23, 12, 0, 0)
  const lista = [
    montador({ id: 1, criadoEm: new Date(2026, 8, 2, 10).toISOString() }),
    montador({ id: 2, criadoEm: new Date(2026, 7, 30, 10).toISOString() }),
    montador({ id: 3 }),
  ]
  assert.equal(contarNovosNoMes(lista, agora), 1)
})

test('data de cadastro', () => {
  assert.equal(formatarDataCadastro(new Date(2026, 9, 12, 10).toISOString()), '12 Out 2026')
  assert.equal(formatarDataCadastro(undefined), '—')
})

test('termo com letras e dígitos não vira busca por CPF', () => {
  const lista = [montador({ id: 1, email: 'ana@x.com', cpf: '17889343057' })]
  assert.deepEqual(filtrarMontadores(lista, 'montador-1788934').map((m) => m.id), [])
  assert.deepEqual(filtrarMontadores(lista, '178.893').map((m) => m.id), [1])
})
