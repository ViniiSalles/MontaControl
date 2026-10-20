import { test } from 'node:test'
import assert from 'node:assert/strict'
import { StatusPedido } from '@montacontrol/shared'
import type { AcompanhamentoPedidoDTO } from '@montacontrol/shared'
import { filtrarPedidos, percentual, resumirProdutividade, tempoRelativo } from '../dashboard.ts'

function pedido(sobrescritas: Partial<AcompanhamentoPedidoDTO>): AcompanhamentoPedidoDTO {
  return {
    pedidoId: 1,
    numeroPedido: 'PED-1',
    statusPedido: StatusPedido.EM_ENTREGA,
    cliente: { nome: 'Ana', cidade: 'BH', estado: 'MG' },
    montadores: [],
    etapa: 'NO_ESTOQUE',
    totalPecas: 4,
    pecasNoEstoque: 4,
    pecasNoCliente: 0,
    pecasInconsistentes: 0,
    avariasAbertas: 0,
    ultimaTriagemEm: null,
    ultimoDescarregamentoEm: null,
    ...sobrescritas,
  }
}

test('filtrarPedidos separa em andamento, pendências e concluídos', () => {
  const pedidos = [
    pedido({ pedidoId: 1 }),
    pedido({ pedidoId: 2, etapa: 'NO_CLIENTE' }),
    pedido({ pedidoId: 3, etapa: 'EM_DESCARREGAMENTO', pecasInconsistentes: 1 }),
    pedido({ pedidoId: 4, etapa: 'NO_CLIENTE', avariasAbertas: 2 }),
  ]
  const ids = (lista: AcompanhamentoPedidoDTO[]) => lista.map((item) => item.pedidoId)

  assert.deepEqual(ids(filtrarPedidos(pedidos, 'andamento')), [1, 3])
  assert.deepEqual(ids(filtrarPedidos(pedidos, 'pendencias')), [3, 4])
  assert.deepEqual(ids(filtrarPedidos(pedidos, 'concluidos')), [2, 4])
  assert.equal(filtrarPedidos(pedidos, 'todos').length, 4)
})

test('percentual não divide por zero', () => {
  assert.equal(percentual(0, 0), 0)
  assert.equal(percentual(1, 3), 33)
})

test('tempoRelativo em minutos, horas e dias', () => {
  const agora = new Date('2026-10-20T12:00:00Z')
  assert.equal(tempoRelativo('2026-10-20T11:59:40Z', agora), 'agora')
  assert.equal(tempoRelativo('2026-10-20T11:55:00Z', agora), 'há 5 min')
  assert.equal(tempoRelativo('2026-10-20T09:00:00Z', agora), 'há 3 h')
  assert.equal(tempoRelativo('2026-10-18T12:00:00Z', agora), 'há 2 dias')
})

test('resumirProdutividade soma a semana e acha o topo da escala', () => {
  const resumo = resumirProdutividade([
    { dia: '2026-10-19', pecasTriadas: 10, pecasDescarregadas: 4 },
    { dia: '2026-10-20', pecasTriadas: 2, pecasDescarregadas: 12 },
  ])
  assert.deepEqual(resumo, {
    totalTriadas: 12,
    totalDescarregadas: 16,
    mediaDiariaDescarregadas: 8,
    maximo: 12,
  })
})
