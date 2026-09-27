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

## Testes e2e (Playwright) e limpeza de dados

A suíte em `e2e/` roda contra a API real e o Supabase de dev, criando atestados (com fotos no bucket),
jornadas do montador seed e um montador `e2e-montador-*@teste.montacontrol.local` por execução.
O `globalSetup` grava o instante de início (`e2e/.inicio-execucao`, ignorado no git) e o
`globalTeardown` chama `pnpm --filter @montacontrol/api e2e:limpar --desde <início - 5s>`, mesmo
quando testes falham. A limpeza nunca derruba a suíte (falhas viram aviso). Premissa: API e testes
rodam na mesma máquina, então a margem de 5s cobre a diferença de relógio.

Limpeza manual (a partir de `Codigo/`); `--dry-run` só lista o que seria removido:

```bash
pnpm --filter @montacontrol/api e2e:limpar --desde 2026-09-26T00:00:00Z --dry-run
pnpm --filter @montacontrol/api e2e:limpar --desde 2026-09-26T00:00:00Z --escopos atestados,jornadas,usuarios-e2e
```

Escopos: `atestados` e `jornadas` (do montador seed) e `usuarios-e2e` (usuários `e2e-montador-*` e o
usuário no Supabase Auth). Só remove registros com `createdAt >= --desde`.
