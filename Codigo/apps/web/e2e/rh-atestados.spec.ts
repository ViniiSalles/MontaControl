import { expect, test } from '@playwright/test'
import { autenticar, criarAtestadoPendente, entrarComoRh, hojeISO, USUARIOS_SEED } from './apoio/api'

// N3T2 — aprovação de atestado médico submetido pelo montador (US13, UC18).
test('N3T2 — RH visualiza a foto por Signed URL e aprova o atestado', async ({ page, request }) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await criarAtestadoPendente(request, token, hojeISO())

  await entrarComoRh(page)
  await expect(page.getByRole('heading', { name: 'Gestão de Atestados' })).toBeVisible()

  const linha = page.getByRole('row', { name: /Montador Seed/ }).first()
  await linha.getByRole('button', { name: 'Analisar' }).click()

  const modal = page.getByRole('dialog')
  const foto = modal.getByRole('img', { name: 'Foto do atestado' })
  await expect(foto).toBeVisible()
  // A foto vem do bucket privado: só abre por URL assinada.
  await expect(foto).toHaveAttribute('src', /token=/)

  await modal.getByRole('button', { name: 'Aprovar' }).click()

  await expect(modal).toBeHidden()
  await expect(page.getByRole('alert')).toContainText('aprovado')
})

// N8T3 — rejeição de atestado com preenchimento de motivo pelo RH (US13, UC18).
test('N8T3 — RH rejeita informando o motivo', async ({ page, request }) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await criarAtestadoPendente(request, token, hojeISO())

  await entrarComoRh(page)
  const linha = page.getByRole('row', { name: /Montador Seed/ }).first()
  await linha.getByRole('button', { name: 'Analisar' }).click()

  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: 'Rejeitar' }).click()
  await modal
    .getByRole('textbox', { name: 'Motivo da rejeição' })
    .fill('Documento ilegível na foto enviada.')
  await modal.getByRole('button', { name: 'Confirmar rejeição' }).click()

  await expect(modal).toBeHidden()
  await expect(page.getByRole('alert')).toContainText('rejeitado')
})
