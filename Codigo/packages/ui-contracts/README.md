# `@montacontrol/ui-contracts`

Contratos de props — **só tipos, zero runtime**. Garante em tempo de compilação que as
implementações Web (`apps/web/src/ui`) e Mobile (`apps/mobile/src/ui`) de um componente expõem a
mesma API. Não compartilhamos *implementação* de componente visual entre as plataformas — os dois
designs não são o mesmo design (ver plano, seção "Componentes"); o que se compartilha é o contrato.

**Importar por subpath** (`@montacontrol/ui-contracts/botao`, não `@montacontrol/ui-contracts`).
Existe `src/index.ts` só para `main`/`types`/`react-native` do `package.json`, mesmo motivo do
`@montacontrol/design-tokens`.

## Escopo desta versão

O plano lista 12 componentes (`Texto`, `Icone`, `Botao`, `CampoTexto`, `Cartao`, `Modal`, `Badge`,
`Alerta`, `PulsoAtividade`, `Tela`, `Carregando`, `BarraNavInferior`). Este pacote cobre só os 4 que
a Fase 11 (esqueleto web) consome: **`Botao`, `CampoTexto`, `Cartao`, `Alerta`**. Os outros 8 são
primitivas mobile-only sem consumidor web na Sprint 1 — entram quando a Fase 8/9 (mobile) começar,
puramente aditivo, sem retrabalho do que já existe aqui.

## Componentes

| Módulo | Referência Stitch | Contrato |
| --- | --- | --- |
| `botao` | `login_montacontrol:139` | `variante` (`primario\|tonal\|fantasma\|perigo\|icone`), `tamanho` (`40\|48\|56`), `forma` (`pilula\|retangular`), `carregando`, `larguraTotal` |
| `campo-texto` | `login_montacontrol:107-116` | `rotulo`, `tipo` (`senha` liga o toggle de visibilidade), `iconeEsquerda`, `acaoRotulo` (slot "Esqueci minha senha"), `erro`, `ajuda` |
| `cartao` | `jornada_home:111` | `elevacao`, `tom` (`padrao\|baixo\|inverso`), `rodape` (sem linha divisória — DESIGN.md §5) |
| `alerta` | — | `variante` (`sucesso\|aviso\|erro\|info`), `mensagem`, `titulo` — usado nos critérios de aceite N1T2 (senha incorreta) e TI02 (sessão expirada) |

`botao` e `campo-texto` referenciam `NomeIcone` de `@montacontrol/design-tokens/icones` (única
dependência de runtime real do pacote — continua zero-runtime porque é só tipo). `cartao` usa
`ReactNode` de `react` (`peerDependency`, também só em posição de tipo).

## Teste

`pnpm --filter @montacontrol/ui-contracts test` roda um smoke test que constrói exemplos válidos de
cada `Props*` — para um pacote só-tipos, o teste real é o `tsc --noEmit` aceitar os exemplos; o
script runtime só confirma que os subcaminhos e o barril resolvem.
