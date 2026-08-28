# MontaControl — Guia do Projeto

Sistema de gestão logística e controle operacional para montagem de móveis planejados, com aplicação
Web e Mobile. Este documento orienta como trabalhar no código deste repositório.

## Estrutura do repositório

```
.
├── Documentacao/     # Artefatos de documentação do TCC (visão, projeto, etc.)
├── Artefatos/         # Diagramas e modelos
├── Divulgacao/        # Material de divulgação
└── Codigo/            # TODO o código-fonte do projeto vive aqui
    ├── apps/
    │   ├── api/        # Backend NestJS
    │   ├── mobile/      # App React Native (Expo)
    │   └── web/         # App Web (Vite + React)
    └── packages/        # Pacotes compartilhados entre apps (workspaces)
```

Nunca coloque código-fonte fora de `Codigo/`. A documentação do TCC (`Documentacao/`, `Artefatos/`,
`Divulgacao/`) não deve ser alterada em PRs de código, salvo quando a própria tarefa exigir atualizar
um artefato (ex.: diagrama do DER após mudança de schema).

## Monorepo

- Gerenciador de pacotes: **pnpm**, usando **pnpm workspaces**. Sem Turborepo/Nx — não adicionar
  orquestrador de build sem alinhar antes.
- `.npmrc` com `node-linker=hoisted` é obrigatório (React Native/Metro não lidam bem com o
  `node_modules` simbolicado default do pnpm). Não remover essa configuração.
- Configurações de lint, TypeScript, Prettier e afins ficam centralizadas na raiz de `Codigo/` e são
  estendidas pelos pacotes/apps — evite duplicar config local sem necessidade.

## Arquitetura do Backend (`apps/api` — NestJS)

Camadas obrigatórias, nessa ordem de dependência:

```
Controller → Service → Repository → Model (Prisma)
```

| Camada         | Responsabilidade                                                        | Proibido                                                         |
| -------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Controller** | Borda HTTP: rotas, DTOs de entrada validados, códigos de status, guards | Regra de negócio; tocar Prisma diretamente                       |
| **Service**    | Regra de negócio                                                        | Importar `PrismaService` ou tipos de query do Prisma diretamente |
| **Repository** | Encapsula chamadas ao Prisma Client. Assinaturas em termos de domínio   | Regra de negócio                                                 |
| **Model**      | Tipos gerados pelo Prisma Client a partir do `schema.prisma`            | Escrever à mão                                                   |

Regras práticas:

- **Um repositório por entidade/agregado, sempre** — inclusive em CRUD simples. É o que garante que o
  Service nunca precise conhecer o Prisma, e permite testar services com duplos de teste sem arrastar
  tipos gerados para dentro do teste.
- Organizar por **feature module** (uma pasta por domínio), não por camada técnica.
- Injeção de dependência via **constructor injection**. Token por interface/classe abstrata só quando
  houver uma segunda implementação plausível.
- DTOs de entrada sempre validados com `class-validator`; `ValidationPipe` global.
- Toda rota autenticada/autorizada passa por Guards; nada de checagem de permissão manual dentro do
  controller/service.
- Migrações de banco via Prisma Migrate — nunca alterar schema do banco manualmente fora de migração.

## Arquitetura do Frontend (Web e Mobile)

- **Design tokens em pacote compartilhado (`@montacontrol/design-tokens`), TS puro, sem runtime de
  CSS-in-JS.** Web consome os tokens via um preset Tailwind; Mobile consome via um objeto de tema
  aplicado com `StyleSheet.create`. Não usar NativeWind, Tamagui ou `styled-components` como
  arquitetura principal de estilos — essa decisão está sob avaliação e pode mudar; não trocar sem
  alinhar antes.
- Design tokens (cores, tipografia, espaçamento, raio, elevação) ficam centralizados nesse pacote
  compartilhado — não hardcodar valores de design (cores em hex, px soltos) diretamente nos
  componentes.
- Não compartilhar _implementação_ de componentes visuais entre Web e Mobile — as duas plataformas têm
  layouts e interações distintas. O que é compartilhado são os **tokens de design** e, quando fizer
  sentido, os **contratos de tipos** (props) dos componentes.
- Componentes React seguem boas práticas de re-render: derivar estado no render em vez de `useEffect`
  quando possível, evitar componentes definidos inline dentro de outros componentes, preferir
  `setState` funcional quando o novo valor depende do anterior.
- Importações diretas dos módulos usados (evitar barrel files/`index.ts` que reexportam tudo de um
  pacote) para não prejudicar tree-shaking e bundle size.

## Padrão de nomenclatura

- Estrutura de pastas e sufixos técnicos em **inglês** (`*.guard.ts`, `*.service.ts`,
  `*.repository.ts`, `components/`, `hooks/`).
- Identificadores de domínio (variáveis, campos, nomes de entidade) em **português (pt-BR)**,
  acompanhando o domínio de negócio e a documentação do projeto (ex.: `senha`, `perfil`, `usuario`,
  `UsuariosRepository`).

## Testes

- Backend: testes unitários com o testing module do NestJS (`Test.createTestingModule`), duplos de
  teste via `overrideProvider` no lugar do repositório real; testes de integração/e2e com Supertest.
- Frontend: testes de componente com testing-library (web) / testing-library para React Native
  (mobile).
- Toda funcionalidade nova de backend com regra de negócio não trivial exige teste unitário do
  Service. Rotas críticas (autenticação, autorização) exigem teste de integração.

## Segurança — regras não negociáveis

- Nunca commitar segredos, senhas, chaves de API ou arquivos `.env` (o `.gitignore` já bloqueia isso —
  não contornar).
- Toda entrada de usuário é validada na borda (DTO/Controller), nunca confiar em dado vindo do
  cliente sem validação.
- Rotas que exigem autenticação/autorização usam Guards — nunca checagem ad-hoc dentro do handler.
- Mensagens de erro de autenticação não podem vazar qual etapa falhou (ex.: "credenciais inválidas"
  genérico em vez de diferenciar "usuário não existe" de "senha errada").

## Do's

- **Do** seguir a ordem de camadas Controller → Service → Repository → Model no backend, sempre.
- **Do** consumir os tokens de `@montacontrol/design-tokens` (preset Tailwind na Web, objeto de tema
  no Mobile) para toda estilização.
- **Do** escrever testes para regras de negócio e rotas sensíveis (auth, RBAC).
- **Do** validar todo input externo com DTOs/`class-validator`.
- **Do** manter nomenclatura de domínio em pt-BR e nomenclatura técnica/estrutural em inglês.
- **Do** manter todo o código dentro de `Codigo/`, organizado por app/pacote de workspace.
- **Do** utilize o mcp e skill do code-graph sempre que possível para navegar entre os arquivos do projeto e entender as dependências entre eles.

## Don'ts

- **Don't** acessar o Prisma diretamente de um Service ou Controller — sempre via Repository.
- **Don't** usar NativeWind, Tamagui como arquitetura principal de estilo sem
  alinhar antes — o projeto atualmente usa preset Tailwind (Web) + tema `StyleSheet` (Mobile), ambos
  consumindo `@montacontrol/design-tokens`.
- **Don't** adicionar Turborepo, Nx ou outro orquestrador de monorepo sem alinhar antes — o projeto usa
  pnpm workspaces puro.
- **Don't** compartilhar implementação de componente visual entre Web e Mobile — compartilhar apenas
  tokens de design e, quando aplicável, contratos de tipos.
- **Don't** hardcodar cores, espaçamentos ou tipografia diretamente nos componentes — usar os tokens de
  design via tema.
- **Don't** commitar arquivos `.env`, segredos, chaves ou credenciais.
- **Don't** criar abstrações ou pacotes de configuração compartilhada além do necessário — prefira
  configuração simples e explícita na raiz do workspace a indireção prematura.
