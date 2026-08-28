const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const raizMonorepo = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

// `watchFolders` precisa cobrir a raiz do monorepo: sem isso o watcher do
// Metro (Watchman) não enxerga `packages/*` (fora de `apps/mobile`), e ele
// não consegue nem resolver nem observar mudanças no `.ts` cru que
// `design-tokens`/`ui-contracts` entregam (sem build step). Verificado via
// bundle real (`curl .../index.bundle`) importando `@montacontrol/design-tokens/cores`
// — resolve e transforma normalmente; o transform de TS já é comportamento
// padrão do Metro (via `babel-preset-expo`), não algo que precise ser forçado
// por opção de resolver.
config.watchFolders = [raizMonorepo];
// Garante que o resolver também enxergue os `node_modules` da raiz do
// monorepo (hoisted), além do `node_modules` local do app.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(raizMonorepo, 'node_modules'),
];

module.exports = config;
