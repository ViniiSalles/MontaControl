import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * `prisma generate` (postinstall) não fala com o banco — não pode falhar só
 * porque `.env` ainda não existe. `migrate`/`seed`/`studio` precisam de
 * `DIRECT_URL` real; sem ela a conexão falha na hora.
 */
const urlDireta = process.env.DIRECT_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  // CLI-only (migrate/seed/studio): sessão sem pgbouncer=true, necessária
  // para o advisory lock do `migrate deploy`. Runtime da app usa DATABASE_URL
  // via PrismaPg em prisma.service.ts, sem passar por este config.
  ...(urlDireta
    ? {
        datasource: {
          url: urlDireta,
        },
      }
    : {}),
});
