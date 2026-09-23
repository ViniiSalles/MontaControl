import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DiaEspelhoDTO } from '@montacontrol/shared'
import {
  colunasDoDia,
  contarFaltas,
  hojeCivil,
  ocorrenciaDoDia,
  resumoDoMes,
  ultimosDiasComMarcacao,
} from '../espelho.ts'

function dia(parcial: Partial<DiaEspelhoDTO> & { data: string }): DiaEspelhoDTO {
  return {
    inicio: null,
    fim: null,
    minutosTrabalhados: 0,
    emAndamento: false,
    lancadoEmAtraso: false,
    justificativaLancamento: null,
    abonado: false,
    diaUtil: true,
    turnos: [],
    ...parcial,
  }
}

const HOJE = '2026-09-23'

test('precedência: abonado vence tudo', () => {
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-01', abonado: true }), HOJE), 'ABONADO')
})

test('em andamento', () => {
  assert.equal(ocorrenciaDoDia(dia({ data: HOJE, emAndamento: true, minutosTrabalhados: 60 }), HOJE), 'EM_ANDAMENTO')
})

test('dia útil passado sem marcação é falta; hoje/futuro sem marcação não tem ocorrência', () => {
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-22' }), HOJE), 'FALTA')
  assert.equal(ocorrenciaDoDia(dia({ data: HOJE }), HOJE), null)
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-30' }), HOJE), null)
})

test('dia não útil sem trabalho', () => {
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-20', diaUtil: false }), HOJE), 'NAO_UTIL')
})

test('lançado em atraso vence HE', () => {
  assert.equal(
    ocorrenciaDoDia(dia({ data: '2026-09-21', lancadoEmAtraso: true, minutosTrabalhados: 600 }), HOJE),
    'LANCADO_EM_ATRASO',
  )
})

test('HE acima de 8h ou trabalho em dia não útil; regular caso contrário', () => {
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-21', minutosTrabalhados: 633 }), HOJE), 'HE')
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-20', diaUtil: false, minutosTrabalhados: 120 }), HOJE), 'HE')
  assert.equal(ocorrenciaDoDia(dia({ data: '2026-09-21', minutosTrabalhados: 480 }), HOJE), 'REGULAR')
})

test('colunas: 0, 1 e 3 turnos', () => {
  assert.deepEqual(colunasDoDia(dia({ data: HOJE })), {
    entrada: null, saidaIntervalo: null, retornoIntervalo: null, saida: null,
  })
  const turno = (inicio: string, fim: string | null) => ({ inicio, fim, minutosTrabalhados: 0, lancadoEmAtraso: false })
  assert.deepEqual(colunasDoDia(dia({ data: HOJE, turnos: [turno('A', 'B')] })), {
    entrada: 'A', saidaIntervalo: null, retornoIntervalo: null, saida: 'B',
  })
  assert.deepEqual(
    colunasDoDia(dia({ data: HOJE, turnos: [turno('A', 'B'), turno('C', 'D'), turno('E', 'F')] })),
    { entrada: 'A', saidaIntervalo: 'B', retornoIntervalo: 'C', saida: 'F' },
  )
})

test('faltas, resumo e últimos dias', () => {
  const dias = [
    dia({ data: '2026-09-21', minutosTrabalhados: 480 }),
    dia({ data: '2026-09-22' }),
    dia({ data: '2026-09-20', diaUtil: false }),
    dia({ data: '2026-09-23', minutosTrabalhados: 300 }),
  ]
  assert.equal(contarFaltas(dias, HOJE), 1)
  assert.deepEqual(resumoDoMes(dias), { minutosTrabalhados: 780, diasComMarcacao: 2, mediaDiariaMinutos: 390 })
  assert.deepEqual(
    ultimosDiasComMarcacao(dias, 3).map((d) => d.data),
    ['2026-09-23', '2026-09-21'],
  )
  assert.deepEqual(resumoDoMes([]), { minutosTrabalhados: 0, diasComMarcacao: 0, mediaDiariaMinutos: 0 })
})

test('hoje civil no fuso do navegador', () => {
  assert.equal(hojeCivil(new Date('2026-09-24T02:00:00.000Z')), '2026-09-23')
})
