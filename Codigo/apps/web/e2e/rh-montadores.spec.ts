import { expect, test } from '@playwright/test'
import { entrarComoRh } from './apoio/api'

// N3T1 — cadastro de novo montador no sistema (US12, UC17).
test('N3T1 — RH cadastra um montador e depois o inativa', async ({ page }) => {
  const email = `e2e-montador-${Date.now()}@teste.montacontrol.local`
  const nome = `Montador E2E ${Date.now()}`

  await entrarComoRh(page)
  await page.getByRole('link', { name: 'Montadores' }).click()
  await expect(page.getByRole('heading', { name: 'Montadores', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Novo Montador' }).click()
  const modal = page.getByRole('dialog', { name: 'Novo Montador' })
  await modal.getByRole('textbox', { name: 'Nome', exact: true }).fill(nome)
  await modal.getByRole('textbox', { name: 'E-mail', exact: true }).fill(email)
  await modal.getByRole('textbox', { name: 'Senha', exact: true }).fill('MontaControl@E2E1')
  await modal.getByRole('button', { name: 'Cadastrar' }).click()
  await expect(modal).toBeHidden()

  // Resultado esperado: usuário criado com perfil MONTADOR e ativo.
  await page.getByRole('textbox', { name: 'Buscar montador' }).fill(email)
  const linha = page.getByRole('row', { name: new RegExp(email) })
  await expect(linha).toBeVisible()
  await expect(linha).toContainText('Ativo')

  await linha.getByRole('button', { name: 'Inativar' }).click()
  await expect(linha).toContainText('Inativo')
})

// Regressão: cancelar o modal não pode deixar dados (inclusive senha) para a próxima abertura.
test('N3T1 — modal "Novo Montador" abre sempre vazio, mesmo após cancelar com dados digitados', async ({ page }) => {
  await entrarComoRh(page)
  await page.getByRole('link', { name: 'Montadores' }).click()

  await page.getByRole('button', { name: 'Novo Montador' }).click()
  let modal = page.getByRole('dialog', { name: 'Novo Montador' })
  await modal.getByRole('textbox', { name: 'Nome', exact: true }).fill('Rascunho Descartado')
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  await expect(modal).toBeHidden()

  await page.getByRole('button', { name: 'Novo Montador' }).click()
  modal = page.getByRole('dialog', { name: 'Novo Montador' })
  await expect(modal.getByRole('textbox', { name: 'Nome', exact: true })).toHaveValue('')
  await modal.getByRole('button', { name: 'Cancelar' }).click()
})
