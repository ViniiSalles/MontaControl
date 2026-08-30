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
