import { cores } from '../cores';

const kebab = (chave: string) => chave.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

/** Tokens de cor como propriedades CSS customizadas (`--cor-<papel>`). */
export const variaveisCss: Record<string, string> = Object.fromEntries(
  Object.entries(cores).map(([chave, valor]) => [`--cor-${kebab(chave)}`, valor]),
);

/** Bloco `:root { ... }` pronto para injeção em folha de estilo global. */
export const variaveisCssTexto = `:root {\n${Object.entries(variaveisCss)
  .map(([chave, valor]) => `  ${chave}: ${valor};`)
  .join('\n')}\n}\n`;

/**
 * Utilitários CSS crus que o preset Tailwind não expressa (ex.: efeito
 * "glass panel" do mockup Stitch usa `backdrop-filter`, sem utility
 * Tailwind nativa equivalente sem plugin). Consumidor injeta como CSS
 * global (ex.: `@layer utilities` do Tailwind ou `<style>` próprio).
 */
export const utilitariosCssTexto = `.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
`;
