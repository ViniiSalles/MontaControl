import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // `jose` (dependência do SupabaseJwtGuard) é ESM-only — sem isso, o Jest
  // (CJS) recusa importá-lo com "Unexpected token 'export'". Cobre tanto o
  // hoist plano (`node_modules/jose`) quanto o store real do pnpm
  // (`node_modules/.pnpm/jose@x/node_modules/jose`).
  transformIgnorePatterns: ['/node_modules/(?!jose/|\\.pnpm/jose@)'],
  moduleNameMapper: {
    '^@montacontrol/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  /**
   * O default do Jest é 5s por teste — orçamento de teste unitário, não de
   * e2e. Cada caso aqui fala com o Supabase real em São Paulo: o mais pesado
   * (`check-out encerra a jornada...`) faz duas chamadas ao GoTrue (criar
   * usuário e login, ambas com hash de senha no servidor) mais quatro idas
   * ao Postgres. Roda em ~650ms com o projeto quente e estoura os 5s quando
   * ele está frio, falhando por latência e não por regressão. O mesmo vale
   * para o `afterAll`, que apaga as fixtures uma a uma.
   */
  testTimeout: 30_000,
  globalSetup: '<rootDir>/setup/global-setup.ts',
  setupFiles: ['<rootDir>/setup/env.ts'],
};

export default config;
