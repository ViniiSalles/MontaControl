module.exports = {
  preset: 'jest-expo',
  // NOTA (desvio do brief, ver task-4-report.md): o pnpm guarda pacotes em
  // `node_modules/.pnpm/<chave>/node_modules/<pacote>` mesmo com
  // node-linker=hoisted (pacotes que só existem como dependência transitiva
  // de outro pacote, ex. `@react-native/jest-preset`, nunca ganham symlink
  // direto em `apps/mobile/node_modules`). O padrão literal do brief só
  // olha o primeiro segmento após `node_modules/`; quando esse segmento é
  // `.pnpm/...`, o lookahead nunca reconhece o pacote da whitelist e o
  // arquivo acaba (erroneamente) na lista de ignorados, quebrando o
  // `import` ESM do preset do RN. O grupo `(?:\.pnpm/[^/]+/node_modules/)*`
  // pula esse(s) segmento(s) intermediário(s) do pnpm store antes de testar
  // a whitelist.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)*((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg))',
  ],
  moduleNameMapper: {
    // `native/` é diretório (index.ts, texto.ts, sombra.ts) — precisa de
    // regras mais específicas ANTES da regra geral, senão
    // `@montacontrol/design-tokens/native` mapeia para o arquivo
    // inexistente `src/native.ts` em vez de `src/native/index.ts`.
    '^@montacontrol/design-tokens/native$': '<rootDir>/../../packages/design-tokens/src/native/index.ts',
    '^@montacontrol/design-tokens/native/(.*)$': '<rootDir>/../../packages/design-tokens/src/native/$1.ts',
    '^@montacontrol/design-tokens/(.*)$': '<rootDir>/../../packages/design-tokens/src/$1.ts',
    // `ui-contracts` expõe alguns subpaths em kebab-case cujo arquivo fonte é
    // camelCase (ver `exports` em `packages/ui-contracts/package.json`) — a
    // regra genérica abaixo faz passthrough literal do subpath e não bate com
    // esses arquivos, então essas 3 precisam vir antes dela.
    '^@montacontrol/ui-contracts/campo-texto$': '<rootDir>/../../packages/ui-contracts/src/campoTexto.ts',
    '^@montacontrol/ui-contracts/pulso-atividade$':
      '<rootDir>/../../packages/ui-contracts/src/pulsoAtividade.ts',
    '^@montacontrol/ui-contracts/barra-nav-inferior$':
      '<rootDir>/../../packages/ui-contracts/src/barraNavInferior.ts',
    '^@montacontrol/ui-contracts/(.*)$': '<rootDir>/../../packages/ui-contracts/src/$1.ts',
    // `shared` e um pacote buildado (`main: dist/index.js`) porque a API o
    // consome como CommonJS. Apontar o Jest para o fonte mantem a suite
    // independente de um `pnpm -r build` previo, como ja se faz em
    // `apps/api/jest.config` (ver Codigo/README.md, secao `packages/shared`).
    // No app real quem resolve o TS cru e o campo `react-native` do
    // package.json, lido pelo Metro.
    '^@montacontrol/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  // Sem isto o default do preset (`**/__tests__/**/*.[jt]s?(x)`) coleta
  // tambem os arquivos de apoio que moram em `__tests__/` (fixtures,
  // helpers) e falha com "must contain at least one test". Toda suite do
  // app termina em `.test.ts(x)`.
  testMatch: ['**/*.test.ts?(x)', '<rootDir>/plugins/__tests__/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // LokiJSAdapter (WatermelonDB nos testes de tela) deixa handles abertos
  // depois da suíte — o Jest fica esperando workers e o CI do PR timeouta
  // mesmo com 100% dos testes verdes. ForceExit encerra após o relatório.
  forceExit: true,
};
