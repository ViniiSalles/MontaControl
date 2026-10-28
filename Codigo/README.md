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

## Rate limit atrás dos proxies do Render

O `ThrottlerModule` global (100 req/min) usa o IP do cliente como chave. No Render a API nunca vê
o cliente direto: toda requisição passa pelo Cloudflare e pelo load balancer do Render, e as do Web
ainda passam pelo rewrite `/api/*` do site estático. Sem configuração, `req.ip` é o IP do proxy e
**todos os usuários dividem o mesmo limite**. Duas variáveis (validadas em
`apps/api/src/config/env.validation.ts`) resolvem isso:

| Variável | Default | Efeito |
| --- | --- | --- |
| `CLIENT_IP_HEADER` | ausente | Cabeçalho de onde o rate limit lê o IP. Só aceita `true-client-ip` ou `cf-connecting-ip`, que a borda **sobrescreve** em toda requisição. Valor ausente ou inválido no request cai para `req.ip`. |
| `TRUST_PROXY_HOPS` | `0` | `trust proxy` do Express: quantos proxies à direita do `X-Forwarded-For` são confiáveis para calcular `req.ip`. `0` ignora o cabeçalho e usa o socket. |

**No Render, use `CLIENT_IP_HEADER=true-client-ip` e deixe `TRUST_PROXY_HOPS` em `0`.** Contar hops
no `X-Forwarded-For` não serve lá:

- O Render **não remove** o `X-Forwarded-For` enviado pelo cliente; só acrescenta entradas à direita
  (ex.: `<forjado>, <cliente real>, 172.71.x.x, 10.x.x.x`). Com um hop a mais que o real, `req.ip`
  vira o valor forjado e o cliente escolhe o próprio balde do rate limit.
- O número de hops não é documentado e **difere entre os caminhos**: o Mobile chama a API direto,
  o Web chega via rewrite do site estático, que é mais um proxy na frente. Um valor único não acerta
  os dois.
- O `True-Client-IP`, por outro lado, é preenchido pelo Cloudflare com o IP real e sobrescrito se
  o cliente tentar forjá-lo; um `CF-Connecting-IP` forjado é rejeitado com 403 antes de chegar à API.

Fontes: [header-test](https://github.com/johnbeynon/header-test) (teste de forja dos três cabeçalhos
num web service do Render), [How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks)
(tráfego passa por Cloudflare + load balancer) e a thread
[Missing x-forwarded-for header on /api rewrites](https://community.render.com/t/missing-x-forwarded-for-header-on-api-rewrites-to-backend/24481)
(no rewrite do site estático chegam `cf-connecting-ip`/`true-client-ip`). Nenhuma delas é
documentação formal do Render — por isso a conferência abaixo depois do primeiro deploy.

Em dev local (sem proxy na frente) deixe as duas ausentes: qualquer cabeçalho de IP é forjável ali,
e o default já ignora todos. `TRUST_PROXY_HOPS` só faz sentido atrás de uma cadeia de proxies fixa e
conhecida (ex.: um único Nginx → `1`).

No `render.yaml`, no serviço da API:

```yaml
services:
  - type: web
    name: montacontrol-api
    runtime: node
    # ...
    envVars:
      - key: CLIENT_IP_HEADER
        value: true-client-ip
```

(Sem Blueprint, o mesmo par vai em **Environment** do serviço no dashboard.) Valores fora da lista
derrubam o boot com `Configuração de ambiente inválida` — de propósito.

**Conferência após o deploy:** dispare mais de 100 requisições em 1 minuto de uma rede (ex.: um
`for` com `curl` em `/api/health`) até receber `429`, e confirme que outra rede — o celular no 4G,
pelo app Mobile, e o Web pelo rewrite — continua recebendo `200`. Se as duas redes recebem `429`
juntas, o cabeçalho não está chegando e o limite voltou a ser compartilhado.

## WebSocket de notificações

O gateway Socket.io da API fica no path padrão `/socket.io`. A REST do Web passa pelo rewrite
`/api/*` do site estático, mas o socket não: o rewrite do Render não faz proxy de WebSocket, e
`/socket.io/...` cairia no `/* → /index.html`. Por isso o Web conecta direto na API, em outro
origin, e duas variáveis precisam andar juntas:

| Variável | Onde | Efeito |
| --- | --- | --- |
| `WS_CORS_ORIGENS` | API (runtime) | Origens do Web liberadas no CORS do handshake, separadas por vírgula, só esquema+host (sem barra final nem caminho). Ausente: nenhuma origem de navegador liberada. |
| `VITE_WS_URL` | Web (build do Vite) | URL da API onde o socket conecta. Ausente ou vazia: conecta no próprio origin (dev local, pelo proxy `/socket.io` do Vite). |

Valores no `render.yaml`:

| Ambiente | `VITE_WS_URL` (Web) | `WS_CORS_ORIGENS` (API) |
| --- | --- | --- |
| production | `https://montacontrol-api.onrender.com` | `https://montacontrol-web.onrender.com` |
| development | `https://montacontrol-api-dev.onrender.com` | `https://montacontrol-web-dev.onrender.com` |

`VITE_WS_URL` é embutida no bundle no build: mudar o valor exige um novo deploy do Web. O Mobile não
usa nenhuma das duas — conecta direto na mesma URL da API que usa para a REST (ver
`apps/mobile/README.md`) e não envia `Origin`, então não passa por CORS.

## Testes

- Backend: unitários com `Test.createTestingModule` do NestJS e duplos de teste via
  `overrideProvider` (nunca o repositório real); integração/e2e com Supertest.
- Frontend: testing-library (web) / testing-library para React Native (mobile).
- Toda regra de negócio não trivial no backend exige teste unitário do Service. Rotas de
  autenticação e autorização exigem teste de integração.
