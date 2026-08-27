import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  // CLI-only (migrate/seed/studio): sessão sem pgbouncer=true, necessária
  // para o advisory lock do `migrate deploy`. Runtime da app usa DATABASE_URL
  // via PrismaPg em prisma.service.ts, sem passar por este config.
  datasource: {
    url: env('DIRECT_URL'),
  },
});
