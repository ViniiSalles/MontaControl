import { expect, test } from '@playwright/test'
import { SENHA_SEED } from './apoio/api'

// N2T1 — carregamento do Dashboard com os painéis operacionais (US08, UC11).
test('N2T1 — gestor vê indicadores, acompanhamento de pedidos, alertas e produtividade', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('gestor@montacontrol.local')
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(SENHA_SEED)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/dashboard$/)

  await expect(page.getByText('Montadores em campo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Acompanhamento de pedidos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Alertas recentes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Produtividade semanal' })).toBeVisible()

  await page.getByRole('tab', { name: 'Todos' }).click()
  await expect(page.getByRole('tab', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true')
})
