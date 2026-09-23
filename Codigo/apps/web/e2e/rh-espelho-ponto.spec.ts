import { expect, test } from '@playwright/test'
import { autenticar, baterPontoDeHoje, entrarComoRh, USUARIOS_SEED } from './apoio/api'

/**
 * N3T3 — visualização do espelho de ponto com todas as marcações e saldo
 * calculado (US14, UC19). A metade "Exportar AFD" do caso de teste é a
 * issue #56 (plano 3 da refatoração RH).
 */
test('N3T3 — RH abre o espelho de ponto do montador pelo banco de horas', async ({ page, request }) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await baterPontoDeHoje(request, token)

  await entrarComoRh(page)
  await page.getByRole('link', { name: 'Banco de Horas' }).click()
  await expect(page.getByRole('heading', { name: 'Banco de Horas', exact: true })).toBeVisible()

  await page.getByRole('table', { name: 'Saldos por montador' }).getByRole('row', { name: /Montador Seed/ }).click()
  await page.getByRole('link', { name: 'Ver espelho de ponto' }).click()

  await expect(page.getByRole('heading', { name: 'Espelho de Ponto', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Selecionar montador' })).toHaveValue(/\d+/)

  // Todas as marcações: uma linha por dia do mês, a de hoje com entrada preenchida.
  const agora = new Date()
  const hoje = `${String(agora.getDate()).padStart(2, '0')}/${String(agora.getMonth() + 1).padStart(2, '0')}/${agora.getFullYear()}`
  const tabela = page.getByRole('table', { name: 'Detalhamento mensal' })
  const linhaDeHoje = tabela.getByRole('row', { name: new RegExp(`^${hoje}`) })
  // Coluna 3 = Entrada: o ponto batido acima tem de aparecer.
  await expect(linhaDeHoje.getByRole('cell').nth(2)).not.toHaveText('--:--')

  // Saldo calculado.
  await expect(page.getByText('Banco de horas', { exact: true })).toBeVisible()
})

test('RH abre o espelho pelo menu e filtra por montador e mês', async ({ page }) => {
  await entrarComoRh(page)
  await page.getByRole('link', { name: 'Espelho de Ponto' }).click()
  await expect(page.getByText('Selecione um montador e o mês de referência.')).toBeVisible()

  await page.getByRole('combobox', { name: 'Selecionar montador' }).selectOption({ label: 'Montador Seed' })
  await page.getByRole('button', { name: 'Visualizar' }).click()
  await expect(page.getByRole('table', { name: 'Detalhamento mensal' })).toBeVisible()
})
