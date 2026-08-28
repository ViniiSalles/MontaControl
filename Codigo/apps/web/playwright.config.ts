import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const raizWeb = import.meta.dirname
const raizApi = resolve(raizWeb, '../api')
const reutilizarServidor = !process.env.CI

/**
 * T11.5 — E2E do login web para os 3 perfis administrativos (N1T1/N1T2).
 * Roda contra a API real (`MontaControlDev`, `apps/api/.env`) e os usuários
 * seed (`apps/api/prisma/seed.ts`) — sem mock, mesmo espírito dos
 * `*.e2e-spec.ts` de `apps/api/test`, que também batem no Supabase real.
 * `reuseExistingServer` deixa reaproveitar `api:dev`/`web:dev` já rodando
 * localmente; CI sempre sobe os dois do zero.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm run start:dev',
      cwd: raizApi,
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: reutilizarServidor,
      timeout: 60_000,
    },
    {
      command: 'pnpm run dev',
      cwd: raizWeb,
      url: 'http://localhost:5173',
      reuseExistingServer: reutilizarServidor,
      timeout: 30_000,
    },
  ],
})
