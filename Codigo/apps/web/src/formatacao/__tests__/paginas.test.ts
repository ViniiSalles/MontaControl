import { test } from 'node:test'
import { strictEqual } from 'node:assert'
import { paginasVisiveis } from '../paginas'

test('(1,1) → [1]', () => {
  const resultado = paginasVisiveis(1, 1)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1]))
})

test('(1,3) → [1,2,3]', () => {
  const resultado = paginasVisiveis(1, 3)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1, 2, 3]))
})

test('(1,12) → [1,2,"reticencias",12]', () => {
  const resultado = paginasVisiveis(1, 12)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1, 2, 'reticencias', 12]))
})

test('(6,12) → [1,"reticencias",5,6,7,"reticencias",12]', () => {
  const resultado = paginasVisiveis(6, 12)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1, 'reticencias', 5, 6, 7, 'reticencias', 12]))
})

test('(12,12) → [1,"reticencias",11,12]', () => {
  const resultado = paginasVisiveis(12, 12)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1, 'reticencias', 11, 12]))
})

test('(3,12) → [1,2,3,4,"reticencias",12]', () => {
  const resultado = paginasVisiveis(3, 12)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1, 2, 3, 4, 'reticencias', 12]))
})

test('(4,12) → [1,2,3,4,5,"reticencias",12] (gap de 1 página → mostrar página 2)', () => {
  const resultado = paginasVisiveis(4, 12)
  strictEqual(JSON.stringify(resultado), JSON.stringify([1, 2, 3, 4, 5, 'reticencias', 12]))
})
