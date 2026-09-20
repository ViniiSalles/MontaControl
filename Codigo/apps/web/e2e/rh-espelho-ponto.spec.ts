import { expect, test } from '@playwright/test'
import { autenticar, baterPontoDeHoje, entrarComoRh, USUARIOS_SEED } from './apoio/api'

/**
 * N3T3 — visualização do espelho de ponto com todas as marcações e saldo
 * calculado (US14, UC19). A metade "Exportar AFD" do caso de teste é a
 * issue #56 e não é exercitada aqui.
 */
test('N3T3 — RH abre o espelho de ponto do montador pelo banco de horas', async ({
  page,
  request,
}) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await baterPontoDeHoje(request, token)

  await entrarComoRh(page)
  await page.getByRole('link', { name: 'Banco de Horas' }).click()
  await expect(page.getByRole('heading', { name: 'Banco de Horas' })).toBeVisible()

  // Escopo na tabela de saldos: a de compensações pendentes também mostra o
  // nome do montador em cada linha e ambiguaria o locator por role+nome.
  const tabelaSaldos = page.getByRole('table').first()
  const linha = tabelaSaldos.getByRole('row', { name: /Montador Seed/ })
  await expect(linha).toBeVisible()
  await linha.getByRole('link', { name: 'Espelho de ponto' }).click()

  await expect(page.getByRole('heading', { name: 'Espelho de Ponto' })).toBeVisible()
  await expect(page.getByText('Montador Seed')).toBeVisible()

  // Todas as marcações: uma linha por dia do mês, o de hoje com entrada e saída.
  const diaDeHoje = String(new Date().getDate()).padStart(2, '0')
  const linhaDeHoje = page.getByRole('row', { name: new RegExp(`^${diaDeHoje}\\b`) })
  await expect(linhaDeHoje).not.toContainText('—h')

  // Saldo calculado.
  await expect(page.getByText('Saldo do mês')).toBeVisible()
})
