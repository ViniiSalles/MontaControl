# `@montacontrol/design-tokens`

Tokens de design (cores, tipografia, espaçamento, raio, elevação, ícones) compartilhados entre
Web e Mobile. TS puro, sem runtime de CSS-in-JS, sem build step — os apps consumidores importam
os `.ts` fonte diretamente via seus próprios bundlers (Vite/Metro).

**Importar sempre por subpath** (`@montacontrol/design-tokens/cores`, não
`@montacontrol/design-tokens`). Existe um `src/index.ts` de barril, mas ele só existe para
`main`/`types`/`react-native` do `package.json` — resolvers mais antigos (Metro, `moduleResolution`
não-`bundler`) nem sempre lidam bem com pacotes só-subcaminho. Código novo nunca importa por ele.

## Módulos

| Módulo | Exporta |
| --- | --- |
| `cores` | Papéis semânticos de cor (Material 3) — `primary`, `onSurface`, `errorContainer`, etc., mais `success`/`scrim`/`shadow` |
| `tipografia` | Escala tipográfica (`displayLg`…`labelSm`), cada token com `{ px, lineHeight, peso, tracking }` |
| `espacamento` | Escala numérica de espaçamento (px) + apelidos nomeados (`alturaCampo`, `paddingCartao`, etc.) |
| `raio` | Escala de raio de borda (px), com `md` como o raio padrão do design system |
| `elevacao` | Sombras `box-shadow` (web) tingidas com tons de `cores` |
| `fontes` | Família (`Inter`) e pesos disponíveis |
| `icones` | União de tipos com os nomes de ícone Material Symbols usados pelos consumidores atuais |
| `tipos` | Tipos estruturais compartilhados (`Cor`, `TipografiaToken`) |
| `web/preset` | Preset Tailwind (`{ colors, fontSize, spacing, borderRadius, boxShadow }`) |
| `web/variaveis` | Cores como CSS custom properties (`--cor-*`) + utilitários CSS crus (ex. `.glass-panel`) |

`native/` (adaptador React Native — `StyleSheet`, sombra via `elevation`/`shadowColor`) **fica
deferido para quando a Fase 8/9 (mobile) começar**. Não é uma omissão — o app mobile ainda não
existe no repo, então não há consumidor nem superfície de teste para esse código agora.

## Conversão Stitch → tokens

Os papéis de cor do mockup (`stitch_tcc/login_montacontrol/code.html`) já batem 1:1 com os nomes
em `cores.ts` (`bg-primary-container` → `cores.primaryContainer`, etc.). O raio de borda é o único
remapeamento deliberado, porque a chave `lg` do Tailwind por padrão (8px) não é a mesma coisa que
o `lg` deste design system (12px):

| Classe no mockup | Valor no mockup | Token | Valor do token |
| --- | --- | --- | --- |
| `rounded-lg` | 8px (`0.5rem`) | `raio.md` (= preset `borderRadius.DEFAULT`) | 8px |
| `rounded-xl` | 12px (`0.75rem`) | `raio.lg` (= preset `borderRadius.lg`) | 12px |
| — | — | `raio.xl` (= preset `borderRadius.xl`) | 16px |
| `rounded-full` | 9999px | `raio.full` | 9999px |

## Defeitos resolvidos em relação ao Tailwind cru do mockup

- Canonicaliza os múltiplos usos ad-hoc de overlay/scrim do mockup (fundo do modal, glass panel)
  em um único token `scrim`.
- Adiciona o papel `success` (ausente no config Tailwind do mockup, mas necessário para badges de
  status conforme DESIGN.md §5).
- Corrige o raio `DEFAULT` do Tailwind (0.25rem/4px por padrão) para o valor realmente usado no
  markup (8px) — ver tabela acima.
- Torna as sombras tingidas (`elevacao.ts`) a única fonte de `box-shadow`, em vez de valores
  `rgba(...)` arbitrários repetidos inline em cada classe do mockup.

## Teste

`pnpm --filter @montacontrol/design-tokens test` roda um smoke test (`scripts/smoke-test.ts`) que
importa `web/preset.ts` e os módulos base, e garante que os tipos/valores exportados têm o formato
esperado. Escopo intencionalmente web-only por ora — não há app mobile ainda para testar o
adaptador `native/`.
