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
  globalSetup: '<rootDir>/setup/global-setup.ts',
  setupFiles: ['<rootDir>/setup/env.ts'],
};

export default config;
