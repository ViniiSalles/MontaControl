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

  // Chamar o entrypoint do pacote com o próprio Node, em vez do shim de
  // `node_modules/.bin`: com `node-linker=hoisted` o shim só existe na raiz
  // do workspace, não em `apps/api`, e no Windows ele ainda exigiria o
  // `.cmd` e um shell. `require.resolve` acha o pacote de onde ele estiver.
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: raizApi,
    stdio: 'inherit',
    env: process.env,
  });
}
