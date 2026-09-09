const path = require('path');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        moduleResolution: 'node',
        paths: {
          '@montacontrol/shared': [path.join(__dirname, '../../packages/shared/src/index.ts')],
        },
      },
    }],
  },
  transformIgnorePatterns: ['/node_modules/', '<rootDir>/../generated/'],
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts'],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    './src/auth/**/*.ts': {
      branches: 85,
      lines: 90,
    },
    './src/usuarios/**/*.ts': {
      branches: 85,
      lines: 90,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@montacontrol/shared$': path.join(__dirname, '../../packages/shared/src/index.ts'),
  },
};
