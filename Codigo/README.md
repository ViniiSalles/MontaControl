# Código do Projeto

Monorepo do MontaControl, gerenciado com **pnpm workspaces** (sem Turborepo/Nx). Veja também o
[`CLAUDE.md`](../CLAUDE.md) na raiz do repositório para as diretrizes gerais de arquitetura.

## Estrutura

```
Codigo/
├── package.json  pnpm-workspace.yaml  .npmrc  .nvmrc
├── tsconfig.base.json  eslint.config.mjs  .prettierrc  .editorconfig
├── packages/
│   ├── shared/           # contrato de fio: enums, DTOs, eventos (API ↔ Web ↔ Mobile)
│   ├── design-tokens/    # tokens de design (cores, tipografia, espaçamento…)
│   └── ui-contracts/     # prop types dos componentes base, zero runtime
└── apps/
    ├── api/               # NestJS
    ├── mobile/            # Expo / React Native — ver apps/mobile/README.md
    └── web/               # Vite / React — ver apps/web/README.md
```

## Pré-requisitos

- Node.js `>=22` (ver `.nvmrc`)
- pnpm `>=11` (`corepack enable` ativa a versão fixada em `packageManager`)

## Scripts

Da raiz de `Codigo/`:

```bash
pnpm install       # instala tudo, todos os workspaces
pnpm build         # pnpm -r build — builda cada pacote/app na ordem topológica das deps
pnpm lint          # pnpm -r lint
pnpm test          # pnpm -r test
pnpm api:dev       # sobe a API em watch mode (nest start --watch)
```

Comandos filtrados por pacote usam `pnpm --filter <nome>`, ex.:
`pnpm --filter @montacontrol/api test:e2e`.

## Arquitetura do backend: Controller → Service → Repository → Model

Camada obrigatória, nessa ordem de dependência, sempre — inclusive em CRUD simples:

| Camada         | Responsabilidade                                                      | Proibido                                                     |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Controller** | Borda HTTP: rotas, DTOs de entrada validados, códigos de status, guards | Regra de negócio; tocar Prisma diretamente                   |
| **Service**    | Regra de negócio. Não sabe que existe Prisma                            | Importar `PrismaService` ou tipos de query do Prisma          |
| **Repository** | Encapsula chamadas ao Prisma Client. Assinaturas em termos de domínio    | Regra de negócio                                              |
| **Model**      | Tipos gerados pelo Prisma Client a partir do `schema.prisma`             | Escrever à mão                                                |

**Um repositório por entidade/agregado, sempre.** É o que garante que o Service nunca precise
conhecer o Prisma, e permite testar services com duplos de teste (`overrideProvider`) sem arrastar
tipos gerados para dentro do teste.

Organização por **feature module** (uma pasta por domínio: `auth/`, `usuarios/`), nunca por camada
técnica (nada de `controllers/`, `services/` na raiz de `src`).

## Convenção de nomes

- Estrutura de pastas e sufixos técnicos em **inglês**: `*.guard.ts`, `*.service.ts`,
  `*.repository.ts`, `components/`, `hooks/`.
- Identificadores de domínio (variáveis, campos, nomes de entidade) em **português (pt-BR)**,
  acompanhando o DER e o Documento de Projeto: `senha`, `perfil`, `usuario`, `UsuariosRepository`.

## `packages/shared`

Pacote **buildado** (não consumido como TS cru): `main`/`types` apontam para `dist/`, que é gerado
por `tsc` antes de `apps/api` poder resolvê-lo. Isso evita um bug catalogado no protótipo original
— com `main: src/index.ts` sem build, o `tsc` do `apps/api` recalculava a raiz comum de compilação e
emitia `dist/apps/api/src/main.js`, um caminho que `nest start`/`node dist/main.js` não encontram.

`pnpm -r build` já ordena os pacotes topologicamente pela dependência `workspace:*`. Os testes
(`apps/api`) usam `moduleNameMapper` no Jest apontando direto para `packages/shared/src/index.ts`,
então rodar a suíte de testes nunca depende de um build prévio do `shared`.

**Exceção do Mobile:** o `package.json` do `shared` também declara `"react-native": "src/index.ts"`.
Só o Metro lê esse campo, então API (CommonJS, via `main`) e Web (Vite, via `main`) seguem
consumindo o `dist/`; o app mobile resolve o TS cru, como já faz com `design-tokens` e
`ui-contracts`. Sem isso, rodar o app exigiria um `pnpm -r build` antes de cada `expo start`. O
Jest do mobile tem o `moduleNameMapper` equivalente, pela mesma razão que o do `apps/api`.

## Migrações (Prisma + Supabase) — receitas de resgate

> Esta seção documenta as convenções decididas para a Fase 2/3 da Sprint 1, mesmo antes do
> `schema.prisma` existir neste repositório, para que a primeira pessoa a mexer em banco não
> redescubra os mesmos problemas.

Dois ambientes, ambos na nuvem (Supabase) — **não são intercambiáveis**:

| Ambiente | O que é | Papel |
| --- | --- | --- |
| `MontaControlDev` | Projeto de desenvolvimento | Alvo do fluxo de migração abaixo e dos testes de integração (GoTrue real) |
| `MontaControl` | Projeto de produção/demo | Alvo só de `migrate deploy` |

**Sem shadow database, e sem diff automático.** `prisma migrate dev` usa um shadow database para
detectar drift, o que já exige um role com `CREATE`/`DROP` — o role gerenciado do Supabase não é
superuser, o que dá o clássico `P3014`. Mesmo contornando isso, o shadow nasce vazio e sem o schema
`auth` do Supabase, então a migração histórica `..._fk_auth_users` (a FK de `usuario.auth_user_id`
para `auth.users.id`) não tem como ser reaplicada nele — o comando cai em `P3006`/`P3018`. Gerar o
SQL por diff (`prisma migrate diff --from-config-datasource ... --to-schema-datamodel ...`) também
não serve: com essa mesma FK cruzando para `auth.users`, o Prisma exige que `auth` conste em
`schemas` do datasource para conseguir introspectá-lo, e isso implica ligar `multiSchema` — decisão
que este projeto evita de propósito (ver `CLAUDE.md`). O diff falha com `P4002`. `db push` também
está fora para produzir uma migração versionada: ele aplica DDL direto no banco, sem deixar arquivo
em `prisma/migrations/`. Por isso o fluxo deste projeto escreve o SQL da migração à mão:

1. Editar `prisma/schema.prisma`.
2. Criar a pasta `prisma/migrations/<timestamp>_<nome>/` e escrever `migration.sql` nela à mão, com
   o SQL incremental (só as colunas/índices/constraints que mudaram — nunca o schema inteiro).
   Seguir a convenção de nomes que o Prisma usaria se tivesse gerado o arquivo
   (`<tabela>_<coluna>_key` para `@unique`, `<tabela>_<colunas>_idx` para `@@index`,
   `<tabela>_<coluna>_fkey` para FK): nomes fora do padrão fazem `migrate status`/`migrate diff`
   acusar drift na próxima verificação, mesmo com o schema logicamente idêntico.
3. Aplicar no `MontaControlDev`:

   ```bash
   pnpm --filter @montacontrol/api exec prisma migrate deploy
   ```

   `migrate deploy` lê o histórico em `_prisma_migrations`, aplica só as migrações que ainda não
   constam nele e não usa shadow database em nenhum momento — imune aos dois problemas acima.
4. Conferir com `pnpm --filter @montacontrol/api prisma:migrate:status` (deve responder "Database
   schema is up to date!", sem drift) e rodar `pnpm --filter @montacontrol/api prisma:generate`
   para atualizar o Prisma Client com as colunas novas.
5. Promover para produção com `migrate deploy` (não usa shadow database em nenhum cenário):

   ```bash
   pnpm --filter @montacontrol/api exec dotenv -e .env.production -- prisma migrate deploy
   ```

**As duas connection strings do Supabase, e por que cada uma existe:**

| Variável | Host / porta | Modo | Uso |
| --- | --- | --- | --- |
| `DATABASE_URL` | `aws-0-<região>.pooler.supabase.com:6543` + `?pgbouncer=true&connection_limit=1` | transaction pooler | Runtime da API |
| `DIRECT_URL` | `aws-0-<região>.pooler.supabase.com:5432` | session pooler, IPv4 | Migrações (`db push`, `migrate diff`, `migrate deploy`, `migrate resolve`) |

DDL pelo transaction pooler (`:6543`) **falha silenciosamente ou trava** — nunca rodar migração
apontando para ele. Evitar também `db.<ref>.supabase.co:5432` direto: resolve só IPv6, o que quebra
em quem não tiver IPv6 funcional.

**Nunca** rodar `prisma db push` apontando para o ambiente de produção — ele é alvo só de
`migrate deploy`.

**Testes de integração usam um banco compartilhado na nuvem, não um container descartável.**
`TRUNCATE` global é **proibido** no harness de e2e. Cada execução isola seus próprios dados por
prefixo (`e2e-<uuid>@...`) e limpa exatamente o que criou no `afterAll` — nunca por contagem global.

## Testes

- Backend: unitários com `Test.createTestingModule` do NestJS e duplos de teste via
  `overrideProvider` (nunca o repositório real); integração/e2e com Supertest.
- Frontend: testing-library (web) / testing-library para React Native (mobile).
- Toda regra de negócio não trivial no backend exige teste unitário do Service. Rotas de
  autenticação e autorização exigem teste de integração.
