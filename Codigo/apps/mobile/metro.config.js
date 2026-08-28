const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const raizMonorepo = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

config.watchFolders = [raizMonorepo];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(raizMonorepo, 'node_modules'),
];
// `design-tokens`/`ui-contracts` entregam `.ts` cru (sem build step) — o
// Metro por padrão não transforma TS de dentro de node_modules; como são
// pacotes de workspace linkados (symlink), força a transformação.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
