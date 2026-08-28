/**
 * Barril de compatibilidade de resolução de pacote (`main`/`types`/
 * `react-native` do package.json apontam para cá — Metro e resolvers mais
 * antigos nem sempre lidam bem com `exports` só-subcaminho). Código novo
 * deve importar pelos subcaminhos diretos (`@montacontrol/design-tokens/
 * cores`, etc.) — ver README — não a partir daqui.
 *
 * Só os módulos neutros de plataforma; os adaptadores `web/` e `native/`
 * ficam de fora de propósito (cada um só faz sentido para um consumidor).
 */
export * from './cores';
export * from './tipografia';
export * from './espacamento';
export * from './raio';
export * from './elevacao';
export * from './fontes';
export * from './icones';
export * from './tipos';
