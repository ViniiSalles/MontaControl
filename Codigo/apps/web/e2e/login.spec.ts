import { expect, test } from '@playwright/test'

/**
 * Usuários seed (`apps/api/prisma/seed.ts`, `MontaControlDev`) — mesma senha
 * para os 4 perfis. Nunca criar fixtures ad-hoc aqui: são os únicos usuários
 * garantidos de existir em qualquer ambiente que rode `prisma db seed`.
 */
const SENHA_SEED = 'MontaControl@Seed1'
const USUARIOS = {
  gestor: 'gestor@montacontrol.local',
  rh: 'rh@montacontrol.local',
  deposito: 'deposito@montacontrol.local',
  montador: 'montador@montacontrol.local',
}

async function login(page: import('@playwright/test').Page, email: string, senha: string) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(email)
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

// N1T1 — credenciais válidas por perfil administrativo → redireciona e mostra a tela do perfil.
test.describe('N1T1 — login por perfil administrativo', () => {
  test('GESTOR → Dashboard Gerencial', async ({ page }) => {
    await login(page, USUARIOS.gestor, SENHA_SEED)

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard Gerencial' })).toBeVisible()
  })

  test('RH → Gestão de Atestados', async ({ page }) => {
    await login(page, USUARIOS.rh, SENHA_SEED)

    await expect(page).toHaveURL(/\/atestados$/)
    await expect(page.getByRole('heading', { name: 'Gestão de Atestados' })).toBeVisible()
  })

  test('DEPOSITO → Triagem de Peças', async ({ page }) => {
    await login(page, USUARIOS.deposito, SENHA_SEED)

    await expect(page).toHaveURL(/\/triagem$/)
    await expect(page.getByRole('heading', { name: 'Triagem de Peças' })).toBeVisible()
  })

  test('Sair devolve ao Login e a rota protegida volta a exigir sessão', async ({ page }) => {
    await login(page, USUARIOS.gestor, SENHA_SEED)
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})

// N1T2 — senha incorreta → alerta de credenciais inválidas, acesso negado.
test('N1T2 — senha incorreta mostra alerta de credenciais inválidas', async ({ page }) => {
  await login(page, USUARIOS.gestor, 'senha-incorreta-123')

  await expect(page).toHaveURL(/\/login$/)
  const alerta = page.getByRole('alert')
  await expect(alerta).toBeVisible()
  await expect(alerta).toContainText('Credenciais inválidas')
})

// MONTADOR no web: credenciais válidas, mas perfil é exclusivo do app mobile — recusado, sem sessão.
test('MONTADOR no web é recusado com aviso de app exclusivo', async ({ page }) => {
  await login(page, USUARIOS.montador, SENHA_SEED)

  await expect(page).toHaveURL(/\/login$/)
  const aviso = page.getByRole('status')
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('aplicativo mobile')
})
