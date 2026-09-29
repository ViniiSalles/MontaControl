import { expect, test } from '@playwright/test'
import { autenticar, criarAtestadoPendente, entrarComoRh, hojeISO, USUARIOS_SEED } from './apoio/api'

/**
 * Abre o atestado pendente mais recente do Montador Seed.
 * A lista está ordenada por createdAt ascending; como o Playwright roda com 1 worker (serial),
 * o `.last()` sempre pega o atestado que acaba de ser criado no teste.
 */
async function abrirAtestadoMaisRecente(page: import('@playwright/test').Page): Promise<void> {
  const tabela = page.getByRole('table', { name: 'Atestados' })
  await tabela.getByRole('row', { name: /Montador Seed.*Pendente/i }).last().click()
}

// N3T2 — aprovação de atestado médico submetido pelo montador (US13, UC18).
test('N3T2 — RH visualiza a foto por Signed URL e aprova o atestado', async ({ page, request }) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await criarAtestadoPendente(request, token, hojeISO(), 'Dor lombar após o turno')

  await entrarComoRh(page)
  await expect(page.getByRole('heading', { name: 'Atestados', exact: true })).toBeVisible()
  await expect(page.getByText(/\d+ pendentes?/i)).toBeVisible()

  await abrirAtestadoMaisRecente(page)

  const painel = page.getByRole('complementary', { name: 'Detalhes do Atestado' })
  const foto = painel.getByRole('img', { name: 'Foto do atestado' }).first()
  await expect(foto).toBeVisible()
  // A foto vem do bucket privado: só abre por URL assinada.
  await expect(foto).toHaveAttribute('src', /token=/)

  // Verifica que a observação é visível
  await expect(painel.getByText('Dor lombar após o turno')).toBeVisible()

  await painel.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByRole('status')).toContainText('aprovado')
})

// N8T3 — rejeição de atestado com preenchimento de motivo pelo RH (US13, UC18).
test('N8T3 — RH recusa informando o motivo', async ({ page, request }) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await criarAtestadoPendente(request, token, hojeISO())

  await entrarComoRh(page)
  await abrirAtestadoMaisRecente(page)

  const painel = page.getByRole('complementary', { name: 'Detalhes do Atestado' })
  await painel.getByRole('button', { name: 'Recusar' }).click()
  await expect(painel.getByText('Informe o motivo para recusar.')).toBeVisible()

  await painel.getByRole('textbox', { name: /motivo da recusa/i }).fill('Documento ilegível na foto enviada.')
  await painel.getByRole('button', { name: 'Recusar' }).click()
  await expect(page.getByRole('status')).toContainText('recusado')
})

// Verifica que atestado sem observação mostra "Sem observação"
test('Atestado sem observação exibe texto padrão', async ({ page, request }) => {
  const token = await autenticar(request, USUARIOS_SEED.montador)
  await criarAtestadoPendente(request, token, hojeISO())

  await entrarComoRh(page)
  await abrirAtestadoMaisRecente(page)

  const painel = page.getByRole('complementary', { name: 'Detalhes do Atestado' })
  await expect(painel.getByText('Sem observação')).toBeVisible()
})
