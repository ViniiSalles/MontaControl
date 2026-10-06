import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Perfil, StatusAvaria } from '@montacontrol/shared'
import type { AvariaDTO } from '@montacontrol/shared'
import { acoesDisponiveis, contarAbertas, FILTRO_VAZIO, filtrarAvarias } from '../avarias.ts'

function avaria(sobrescritas: Partial<AvariaDTO>): AvariaDTO {
  return {
    id: 1,
    pecaId: 10,
    descricaoPeca: 'Porta de armário',
    codigoBarras: '789123',
    pedidoId: 1,
    numeroPedido: 'PED-000001',
    ambiente: 'Cozinha',
    tipoAvariaId: 2,
    tipoAvaria: 'Risco',
    descricao: 'Riscada',
    status: StatusAvaria.REPORTADA,
    registradaPor: 7,
    registradaPorNome: 'Fulano',
    registradaPorPerfil: Perfil.DEPOSITO,
    analisadaPor: null,
    analisadaEm: null,
    parecer: null,
    quantidadeFotos: 0,
    criadoEm: '2026-10-05T12:00:00.000Z',
    ...sobrescritas,
  }
}

test('ações seguem o fluxo da API e resolvida não tem ação', () => {
  assert.deepEqual(
    acoesDisponiveis(StatusAvaria.REPORTADA).map((acao) => acao.status),
    [StatusAvaria.EM_ANALISE],
  )
  assert.deepEqual(
    acoesDisponiveis(StatusAvaria.EM_ANALISE).map((acao) => acao.status),
    [StatusAvaria.REPOSICAO_SOLICITADA, StatusAvaria.RESOLVIDA],
  )
  assert.equal(acoesDisponiveis(StatusAvaria.RESOLVIDA).length, 0)
  assert.ok(acoesDisponiveis(StatusAvaria.EM_ANALISE).every((acao) => acao.exigeParecer))
})

test('abertas são as não resolvidas', () => {
  assert.equal(
    contarAbertas([
      avaria({ status: StatusAvaria.REPORTADA }),
      avaria({ status: StatusAvaria.REPOSICAO_SOLICITADA }),
      avaria({ status: StatusAvaria.RESOLVIDA }),
    ]),
    2,
  )
})

test('filtro combina status, origem, tipo e busca por pedido/peça/código', () => {
  const lista = [
    avaria({ id: 1 }),
    avaria({ id: 2, registradaPorPerfil: Perfil.MONTADOR, numeroPedido: 'PED-000002' }),
    avaria({ id: 3, status: StatusAvaria.RESOLVIDA, tipoAvariaId: 5, codigoBarras: null }),
  ]
  const ids = (filtro: Partial<typeof FILTRO_VAZIO>) =>
    filtrarAvarias(lista, { ...FILTRO_VAZIO, ...filtro }).map((item) => item.id)

  assert.deepEqual(ids({}), [1, 2, 3])
  assert.deepEqual(ids({ origem: Perfil.MONTADOR }), [2])
  assert.deepEqual(ids({ status: StatusAvaria.RESOLVIDA }), [3])
  assert.deepEqual(ids({ tipoAvariaId: 5 }), [3])
  assert.deepEqual(ids({ busca: 'ped-000002' }), [2])
  assert.deepEqual(ids({ busca: '789' }), [1, 2])
})
