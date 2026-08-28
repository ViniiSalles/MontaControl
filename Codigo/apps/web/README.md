# `@montacontrol/web`

App web (Vite + React + TypeScript). Consome `@montacontrol/design-tokens` (preset Tailwind) e
`@montacontrol/ui-contracts` (contratos de props) — ver `Documentacao`/plano da Fase 11 para o
escopo completo.

## Tailwind

Tailwind v4 via `@tailwindcss/vite`. `src/index.css` carrega o motor (`@import "tailwindcss"`) e o
config legado (`@config "../tailwind.config.ts"`) — este último existe só para reaproveitar o
preset de `@montacontrol/design-tokens/web/preset` via `theme.extend` (API v3, ainda suportada em
v4 para esse caso). Não hardcodar cor/espaçamento/raio fora dos tokens.

## Rotas

`react-router-dom`, cada página em `src/paginas/` carregada via `React.lazy` (code-splitting por
rota, sem barril de páginas) — ver `bundle-barrel-imports`/`bundle-dynamic-imports`.

## Scripts

- `pnpm dev` — servidor de desenvolvimento.
- `pnpm build` — `tsc -b && vite build`.
- `pnpm lint` — `eslint` com a config raiz do monorepo.
