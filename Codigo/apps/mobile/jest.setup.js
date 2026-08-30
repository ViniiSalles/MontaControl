// `react-native-webview` traz módulo nativo (`RNCWebViewModule`) que não
// existe sob o Jest (não roda em device/simulador) — sem este mock, qualquer
// import da lib derruba a suíte inteira com "TurboModuleRegistry.getEnforcing
// could not be found", mesmo em testes que nunca renderizam o componente.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View };
});
