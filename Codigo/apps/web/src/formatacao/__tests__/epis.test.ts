import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Perfil } from '@montacontrol/shared'
import type { AluguelEpiDTO, TipoEpiDTO, UsuarioDTO } from '@montacontrol/shared'
import {
  colaboradoresParaEpi,
  deDataHoraLocal,
  filtrarAlugueis,
  formatarDuracao,
  paraDataHoraLocal,
  rascunhoAluguelInicial,
  tempoDeAtraso,
  tempoEmUso,
  tempoReservado,
  validarRascunhoAluguel,
  validarRascunhoTipoEpi,
} from '../epis'

function aluguel(parcial: Partial<AluguelEpiDTO> = {}): AluguelEpiDTO {
  return {
    id: 1,
    tipoEpi: { id: 1, nome: 'Luva' },
    colaborador: { id: 5, nome: 'Ana' },
    quantidade: 1,
    inicio: '2026-10-27T11:00:00.000Z',
    fimPrevisto: '2026-10-27T21:00:00.000Z',
    devolvidoEm: null,
    observacao: null,
    registradoPor: { id: 1, nome: 'Gestor' },
    devolucaoRegistradaPor: null,
    status: 'EM_USO',
    ...parcial,
  }
}

const luva: TipoEpiDTO = { id: 1, nome: 'Luva', descricao: '', validadeMeses: 6, estoque: 3, emUso: 1 }

test('formatarDuracao escolhe a maior unidade relevante', () => {
  assert.equal(formatarDuracao(45 * 60_000), '45min')
  assert.equal(formatarDuracao(5 * 3_600_000 + 20 * 60_000), '5h 20min')
  assert.equal(formatarDuracao(3 * 3_600_000), '3h')
  assert.equal(formatarDuracao(2 * 86_400_000 + 3 * 3_600_000), '2d 3h')
  assert.equal(formatarDuracao(-5), '0min')
})

test('tempo reservado, em uso e atraso', () => {
  const agora = new Date('2026-10-27T23:30:00.000Z')
  const atrasado = aluguel({ status: 'ATRASADO' })
  assert.equal(tempoReservado(atrasado), '10h')
  assert.equal(tempoEmUso(atrasado, agora), '12h 30min')
  assert.equal(tempoDeAtraso(atrasado, agora), '2h 30min')

  const devolvidoNoPrazo = aluguel({ status: 'DEVOLVIDO', devolvidoEm: '2026-10-27T19:00:00.000Z' })
  assert.equal(tempoEmUso(devolvidoNoPrazo, agora), '8h')
  assert.equal(tempoDeAtraso(devolvidoNoPrazo, agora), null)

  assert.equal(tempoEmUso(aluguel({ status: 'RESERVADO' }), agora), null)
})

test('filtrarAlugueis: "em aberto" é tudo que não voltou', () => {
  const lista = [aluguel({ id: 1, status: 'RESERVADO' }), aluguel({ id: 2, status: 'ATRASADO' }), aluguel({ id: 3, status: 'DEVOLVIDO' })]
  assert.deepEqual(filtrarAlugueis(lista, 'ABERTOS').map((item) => item.id), [1, 2])
  assert.deepEqual(filtrarAlugueis(lista, 'DEVOLVIDO').map((item) => item.id), [3])
  assert.equal(filtrarAlugueis(lista, 'TODOS').length, 3)
})

test('colaboradoresParaEpi: montadores e operadores ativos, por nome', () => {
  const usuario = (id: number, nome: string, perfil: Perfil, ativo = true): UsuarioDTO => ({ id, nome, email: `${id}@x`, perfil, ativo })
  const lista = [
    usuario(1, 'Zeca', Perfil.MONTADOR),
    usuario(2, 'Bia', Perfil.DEPOSITO),
    usuario(3, 'Gil', Perfil.GESTOR),
    usuario(4, 'Ana', Perfil.MONTADOR, false),
  ]
  assert.deepEqual(colaboradoresParaEpi(lista).map((item) => item.nome), ['Bia', 'Zeca'])
})

test('datetime-local ida e volta no fuso do navegador', () => {
  const data = new Date(2026, 9, 27, 8, 5)
  assert.equal(paraDataHoraLocal(data), '2026-10-27T08:05')
  assert.equal(deDataHoraLocal('2026-10-27T08:05'), data.toISOString())
  assert.equal(deDataHoraLocal(''), null)
})

test('rascunho inicial: devolução prevista às 18h, ou amanhã se já passou', () => {
  assert.equal(rascunhoAluguelInicial(new Date(2026, 9, 27, 9, 0)).fimPrevisto, '2026-10-27T18:00')
  assert.equal(rascunhoAluguelInicial(new Date(2026, 9, 27, 19, 0)).fimPrevisto, '2026-10-28T18:00')
})

test('validarRascunhoAluguel monta o pedido e recusa período invertido e quantidade acima do estoque', () => {
  const base = { tipoEpiId: '1', usuarioId: '5', quantidade: '2', inicio: '2026-10-27T08:00', fimPrevisto: '2026-10-27T18:00', observacao: ' obra ' }
  const ok = validarRascunhoAluguel(base, [luva])
  assert.deepEqual(ok.dados, {
    tipoEpiId: 1,
    usuarioId: 5,
    quantidade: 2,
    inicio: new Date(2026, 9, 27, 8).toISOString(),
    fimPrevisto: new Date(2026, 9, 27, 18).toISOString(),
    observacao: 'obra',
  })

  const invertido = validarRascunhoAluguel({ ...base, fimPrevisto: '2026-10-27T07:00' }, [luva])
  assert.equal(invertido.dados, null)
  assert.ok(invertido.erros.fimPrevisto)

  const demais = validarRascunhoAluguel({ ...base, quantidade: '4' }, [luva])
  assert.equal(demais.dados, null)
  assert.ok(demais.erros.quantidade)
})

test('validarRascunhoTipoEpi não deixa estoque abaixo do que está alugado', () => {
  const base = { nome: ' Capacete ', descricao: '', validadeMeses: '12', estoque: '5' }
  assert.deepEqual(validarRascunhoTipoEpi(base, 2).dados, { nome: 'Capacete', descricao: '', validadeMeses: 12, estoque: 5 })
  assert.ok(validarRascunhoTipoEpi({ ...base, estoque: '1' }, 2).erros.estoque)
  assert.ok(validarRascunhoTipoEpi({ ...base, estoque: '' }, 0).erros.estoque)
})
