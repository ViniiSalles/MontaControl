// `react-native-webview` traz módulo nativo (`RNCWebViewModule`) que não
// existe sob o Jest (não roda em device/simulador) — sem este mock, qualquer
// import da lib derruba a suíte inteira com "TurboModuleRegistry.getEnforcing
// could not be found", mesmo em testes que nunca renderizam o componente.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});

// `SafeAreaProvider` real espera as medidas chegarem do lado nativo antes de
// renderizar os filhos; sob o Jest elas nunca chegam e a árvore fica só com
// `<RNCSafeAreaProvider />` vazio, derrubando qualquer teste de tela. O mock
// oficial da lib fornece as medidas de imediato.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// O módulo real do NetInfo cria um listener/handle nativo ao ser importado,
// que nunca fecha sob o Jest — mesmo em testes que nunca chamam
// `NetInfo.addEventListener` (basta o `import` no topo do arquivo), o
// processo fica pendurado com "Jest did not exit one second after the test
// run has completed". O mock oficial da lib evita isso.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

// `SQLiteAdapter` (usado pelo banco local real, `db/database.ts`, importado a
// partir de `App.tsx` e de `AuthContext.tsx#sair`) tenta inicializar bindings
// JSI nativos assim que é construído — bindings que não existem sob o Jest,
// derrubando qualquer suíte que sequer importe esses arquivos (mesmo que o
// banco de teste real usado nos testes seja outro, via `criarBancoDeTeste`/
// LokiJSAdapter). Nenhum teste consulta esse adapter de verdade, então um
// stub que só guarda o `schema` recebido é suficiente — `new Database(...)`
// lê `adapter.schema.tables` na hora de montar as coleções, mesmo sem
// nenhuma query real ser feita.
jest.mock('@nozbe/watermelondb/adapters/sqlite', () => {
  return class SQLiteAdapterMock {
    constructor(options) {
      this.schema = options?.schema;
    }
  };
});
