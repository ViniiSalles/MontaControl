import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  competenciaParaTexto,
  diaDaSemana,
  diasCorridos,
  formatarDataHoraCurta,
  formatarDiaCivil,
  formatarDiaMes,
  formatarHora,
  nomeDoMes,
  textoParaCompetencia,
} from '../datas.ts'

test('dia civil sem deslocamento de fuso', () => {
  assert.equal(formatarDiaCivil('2026-10-01'), '01/10/2026')
  assert.equal(formatarDiaMes('2026-10-14'), '14/10')
})

test('dia da semana a partir do dia civil', () => {
  assert.equal(diaDaSemana('2026-09-21'), 'Segunda')
  assert.equal(diaDaSemana('2026-09-27'), 'Domingo')
})

test('dias corridos inclusivos, atravessando mês', () => {
  assert.equal(diasCorridos('2026-10-14', '2026-10-14'), 1)
  assert.equal(diasCorridos('2026-10-14', '2026-10-17'), 4)
  assert.equal(diasCorridos('2026-09-30', '2026-10-01'), 2)
})

test('data e hora curtas no fuso de operação', () => {
  assert.equal(formatarDataHoraCurta('2026-10-14T11:30:00.000Z'), '14 Out 2026, 08:30')
  assert.equal(formatarHora('2026-10-14T11:05:00.000Z'), '08:05')
  assert.equal(formatarHora(null), '--:--')
})

test('nome do mês e competência', () => {
  assert.equal(nomeDoMes(3), 'Março')
  assert.equal(competenciaParaTexto(2026, 9), '2026-09')
  assert.deepEqual(textoParaCompetencia('2026-09'), { ano: 2026, mes: 9 })
  assert.equal(textoParaCompetencia('2026-13'), null)
  assert.equal(textoParaCompetencia(''), null)
})
