import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Perfil } from '@montacontrol/shared'
import type { UsuarioDTO } from '@montacontrol/shared'
import {
  alternarSelecao,
  aplicarEquipe,
  filtrarPorNome,
  montadoresDisponiveis,
  textoQuantidadeMontadores,
} from '../equipes.ts'

function usuario(id: number, nome: string, perfil: Perfil, ativo = true): UsuarioDTO {
  return { id, nome, email: `${id}@x.com`, perfil, ativo }
}

test('disponíveis são só montadores ativos, em ordem alfabética', () => {
  const lista = montadoresDisponiveis([
    usuario(1, 'Zeca', Perfil.MONTADOR),
    usuario(2, 'Ana', Perfil.MONTADOR),
    usuario(3, 'Bia', Perfil.GESTOR),
    usuario(4, 'Caio', Perfil.MONTADOR, false),
  ])
  assert.deepEqual(
    lista.map((item) => item.nome),
    ['Ana', 'Zeca'],
  )
})

test('aplicar equipe soma os membros ativos sem tirar os avulsos', () => {
  const equipe = {
    id: 1,
    nome: 'Norte',
    membros: [
      { id: 2, nome: 'Ana', ativo: true },
      { id: 5, nome: 'Davi', ativo: true },
      { id: 6, nome: 'Inativo', ativo: false },
    ],
  }
  assert.deepEqual(aplicarEquipe([9, 2], equipe), [9, 2, 5])
})

test('alternar marca e desmarca', () => {
  assert.deepEqual(alternarSelecao([1, 2], 2), [1])
  assert.deepEqual(alternarSelecao([1], 3), [1, 3])
})

test('busca por nome ignora acento e caixa', () => {
  const itens = [{ nome: 'João Silva' }, { nome: 'Maria' }]
  assert.deepEqual(filtrarPorNome(itens, 'joao'), [{ nome: 'João Silva' }])
  assert.equal(filtrarPorNome(itens, '  ').length, 2)
})

test('texto da quantidade de montadores', () => {
  assert.equal(textoQuantidadeMontadores(0), 'Nenhum montador')
  assert.equal(textoQuantidadeMontadores(1), '1 montador')
  assert.equal(textoQuantidadeMontadores(7), '7 montadores')
})
