import { execFileSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Jest `globalSetup`: roda uma única vez, num processo à parte, antes de
 * qualquer worker subir. Aplica as migrações pendentes no MontaControlDev
 * via `prisma migrate deploy` — sem isso, um teste rodando contra um schema
 * desatualizado falha de forma confusa, longe da causa real.
 *
 * `override: true` garante DIRECT_URL/DATABASE_URL de `.env.test`, mesmo que
 * `prisma.config.ts` (via `import 'dotenv/config'`) tente carregar `.env`
 * depois — dotenv nunca sobrescreve uma variável já presente em `process.env`.
 */
export default async function globalSetup(): Promise<void> {
  const raizApi = resolve(__dirname, '../..');
  config({ path: resolve(raizApi, '.env.test'), override: true, quiet: true });

  // No Windows, o shim sem extensão é um script POSIX que o CreateProcess
  // nativo não executa — o `.cmd` é o equivalente que o Windows entende.
  const prismaBin = resolve(
    raizApi,
    'node_modules/.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  );
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: raizApi,
    stdio: 'inherit',
    env: process.env,
    // `.cmd` é um script de lote: desde o Node 18 ele só roda via shell.
    shell: process.platform === 'win32',
  });
}
