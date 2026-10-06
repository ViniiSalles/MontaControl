import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adicionarItensImportados,
  converterRascunhoPedido,
  filtrarPedidos,
  extrairItensDaPlanilha,
  MAXIMO_ITENS_PLANILHA,
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

test('planilha com cabeçalho localiza as colunas pelo nome, em qualquer ordem', () => {
  const resultado = extrairItensDaPlanilha([
    ['Qtd.', 'Código', 'Descrição da peça'],
    [2, 'A1', ' Porta 90cm '],
    [null, 'A2', 'Prateleira'],
    [null, null, null],
    ['10', 'A3', 'Puxador'],
  ])

  assert.deepEqual(resultado, {
    itens: [
      { descricao: 'Porta 90cm', quantidade: '2' },
      { descricao: 'Prateleira', quantidade: '1' },
      { descricao: 'Puxador', quantidade: '10' },
    ],
  })
})

test('planilha sem cabeçalho usa coluna A como descrição e B como quantidade', () => {
  assert.deepEqual(extrairItensDaPlanilha([[], ['Gaveta', 3], ['Dobradiça']]), {
    itens: [
      { descricao: 'Gaveta', quantidade: '3' },
      { descricao: 'Dobradiça', quantidade: '1' },
    ],
  })
})

test('peça cujo nome começa com "Peça" na primeira linha não vira cabeçalho', () => {
  assert.deepEqual(extrairItensDaPlanilha([['Peça lateral', 2]]), {
    itens: [{ descricao: 'Peça lateral', quantidade: '2' }],
  })
})

test('cabeçalho sem coluna de quantidade assume 1 para todas as peças', () => {
  assert.deepEqual(extrairItensDaPlanilha([['Peça'], ['Lateral']]), {
    itens: [{ descricao: 'Lateral', quantidade: '1' }],
  })
})

test('planilha inválida aponta a linha do problema', () => {
  assert.match(
    (
      extrairItensDaPlanilha([
        ['Peça', 'Qtd'],
        ['Porta', 1.5],
      ]) as { erro: string }
    ).erro,
    /Linha 2: quantidade/,
  )
  assert.match(
    (
      extrairItensDaPlanilha([
        ['Peça', 'Qtd'],
        ['Porta', 0],
      ]) as { erro: string }
    ).erro,
    /Linha 2: quantidade/,
  )
  assert.match(
    (
      extrairItensDaPlanilha([
        ['Peça', 'Qtd'],
        ['Porta', 1],
        [null, 4],
      ]) as { erro: string }
    ).erro,
    /Linha 3: peça sem descrição/,
  )
  assert.match(
    (extrairItensDaPlanilha([['x'.repeat(201)]]) as { erro: string }).erro,
    /Linha 1: descrição/,
  )
})

test('planilha vazia, só com cabeçalho ou acima do limite é recusada', () => {
  assert.ok('erro' in extrairItensDaPlanilha([]))
  assert.ok('erro' in extrairItensDaPlanilha([[null, '']]))
  assert.ok('erro' in extrairItensDaPlanilha([['Descrição', 'Quantidade']]))

  const muitas = Array.from({ length: MAXIMO_ITENS_PLANILHA + 1 }, (_, i) => [`Peça ${i}`, 1])
  assert.match((extrairItensDaPlanilha(muitas) as { erro: string }).erro, /limite/)
})

test('importação mantém peças digitadas e descarta linhas em branco do formulário', () => {
  const ambiente = adicionarItensImportados(
    {
      nome: 'Cozinha',
      itens: [
        { descricao: 'Tampo', quantidade: '1' },
        { descricao: '  ', quantidade: '1' },
      ],
    },
    [{ descricao: 'Porta', quantidade: '2' }],
  )

  assert.deepEqual(ambiente.itens, [
    { descricao: 'Tampo', quantidade: '1' },
    { descricao: 'Porta', quantidade: '2' },
  ])
})

test('busca de pedidos por número, cliente ou status', () => {
  const base = { clienteId: 1, quantidadeTotal: 0, quantidadeTriada: 0, quantidadeMontadores: 0 }
  const pedidos = [
    { ...base, id: 1, numeroPedido: 'PED-000042', clienteNome: 'José Araújo', status: 'EM_TRIAGEM' },
    { ...base, id: 2, numeroPedido: 'PED-000007', clienteNome: 'Maria Souza', status: 'AGUARDANDO' },
  ] as Parameters<typeof filtrarPedidos>[0]
  const ids = (busca: string) => filtrarPedidos(pedidos, busca).map((pedido) => pedido.id)

  assert.deepEqual(ids(''), [1, 2])
  assert.deepEqual(ids('42'), [1])
  assert.deepEqual(ids('jose araujo'), [1])
  assert.deepEqual(ids('em triagem'), [1])
  assert.deepEqual(ids('MARIA'), [2])
  assert.deepEqual(ids('inexistente'), [])
})
