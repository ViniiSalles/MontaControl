# Roteiro de aceitação: offline-first no aplicativo mobile

Cenários da issue #115 (épico #105), para executar em **aparelho físico ou emulador Android em
modo avião**, com o app gerado da branch de integração `feat/offline-first-epico-105` (#106 a #114
entregues). A decisão de arquitetura testada aqui está em
[`DECISAO-ARQUITETURA-OFFLINE-FIRST.md`](./DECISAO-ARQUITETURA-OFFLINE-FIRST.md).

Este roteiro **ainda não foi executado**. Quem executar marca o resultado de cada item e anexa a
evidência (prints ou vídeo curto) na issue #115.

| Id | Item |
| --- | --- |
| OF01 | Boot offline |
| OF02 | Ponto offline longo (token expira) |
| OF03 | Avaria offline fora da aba Jornada, com 2 fotos |
| OF04 | Atestado offline |
| OF05 | Mudança no servidor (desalocação e validação) |
| OF06 | Primeira instalação (janela do primeiro pull) |
| OF07 | Troca de usuário |
| OF08 | Reinício com pendências |
| OF09 | Expiração forçada da sessão com ações na fila |
| CA01 | Checagem em aparelho: foto da galeria (`content://`) no Android |
| CA02 | Checagem em aparelho: migração do banco local v2 → v3 |
| CA03 | Checagem em aparelho: lacuna offline logo após a atualização |

## Textos da interface usados neste roteiro

| Onde | Texto |
| --- | --- |
| Indicador de sincronização (acima da barra de abas, em todas as abas) | "Sem conexão", "Sincronizando…", "Sincronizado agora" / "Sincronizado há X", "N pendentes", "Servidor sem resposta", "Falha ao sincronizar", "Atualize o aplicativo para sincronizar", "Aguardando a primeira sincronização". Com fila, os estados de atenção mostram "· N pendentes" no fim. |
| Cartão do último ponto (Jornada) | selo "Sincronizando" enquanto a marcação não subiu |
| "MEUS REPORTES" (Avarias) e lista de Atestados | selo "Aguardando envio" enquanto o item está na fila |
| Status de avaria | "Enviada" (reportada), "Em análise", "Reposição solicitada", "Resolvida" |
| Status de atestado | "Em análise" (pendente), "Aprovado", "Recusado" (com o motivo) |
| Recusa depois do envio (Jornada, Avarias, Atestados) | alerta "Uma ação não foi sincronizada", com o texto do servidor, e botão "Dispensar" |
| Banco de horas sem dado local | "Sem dados offline para este mês" |

## Pré-requisitos do ambiente

### API e banco

- Use a **API local** (`pnpm api:dev` na raiz de `Codigo/`) apontando para o projeto Supabase de
  **desenvolvimento** (MontaControlDev), configurado em `Codigo/apps/api/.env` a partir de
  `.env.example`. **Não execute este roteiro contra produção.** O banco de dev é compartilhado com
  a equipe e com os testes e2e.
- Migrações aplicadas, incluindo `20261017120000_suporte_pull_incremental`:
  `pnpm --filter @montacontrol/api prisma:migrate:status` deve responder que o schema está em dia.
- Dados de seed: `pnpm --filter @montacontrol/api prisma:seed` (idempotente). O seed
  (`Codigo/apps/api/prisma/seed.ts`) cria um usuário de cada perfil (Gestor, RH, Montador,
  Depósito), o cliente "Cliente Demonstração" com coordenadas e o pedido `PED-SEED-0001` atribuído
  ao Montador do seed, com um ambiente e duas peças. A senha dos usuários do seed está no próprio
  arquivo e não é reproduzida aqui.
- Para OF05, OF07 e OF09 é preciso um segundo pedido atribuído ao montador e um **segundo
  montador**. Crie pela Web: o RH cadastra montadores (`/montadores`); o Gestor cadastra clientes
  (`/clientes`), pedidos e atribui montadores (`/pedidos`).
- Para consultar o lado servidor: `pnpm --filter @montacontrol/api prisma:studio` (abre as tabelas
  do banco de dev no navegador; use só para leitura).

### Web

`pnpm --filter @montacontrol/web dev`. Telas usadas: Gestor em `/pedidos`, `/clientes` e
`/avarias`; RH em `/atestados`, `/montadores` e `/espelho-ponto`.

### Aplicativo

- **Use um APK release**, gerado conforme `Codigo/apps/mobile/BUILD-APK.md` (seções 5 a 9). O JS
  vai embutido no APK. Um build debug (ou `pnpm android`) busca o JS no Metro pela rede: fechado e
  reaberto em modo avião, ele não carrega. O Expo Go não serve (o WatermelonDB tem módulo nativo).
- **Endereço da API:** no emulador Android o padrão `http://10.0.2.2:3000` já funciona. Em aparelho
  físico, ajuste `expo.extra.apiUrl` no `app.json` para o IP da máquina na rede local e recompile
  (`BUILD-APK.md`, seção 9). Não commite essa alteração. Libere a porta 3000 no firewall.
- **Localização:** o ponto só é aceito a até 200 m das coordenadas do cliente da obra. O app
  confere o raio no aparelho (com as coordenadas da réplica) e o servidor confere de novo.
  - Emulador: em *Extended controls → Location*, defina a posição do "Cliente Demonstração"
    (coordenadas em `seed.ts`) ou do cliente da obra usada.
  - Aparelho físico: o Gestor cadastra um cliente com as coordenadas do local do teste e um pedido
    atribuído ao montador. O GPS funciona em modo avião, mas a primeira leitura pode demorar.
- **Relógio do aparelho:** mantenha automático. A API aceita marcação de ponto só do dia corrente e
  do dia anterior (`REGISTRO_FORA_DA_JANELA`) e usa o horário registrado no aparelho.
- **Voltar a rede:** desligar o modo avião e reconectar ao Wi-Fi da mesma rede da API. Em Wi-Fi
  sem acesso à internet o Android pode marcar a conexão como "sem internet": o indicador fica em
  "Sem conexão" e o gatilho de volta da rede não dispara. Nesse caso, mande o app para segundo plano
  e traga de volta (o retorno ao primeiro plano também sincroniza).

## Como forçar o token a expirar (OF02, OF09)

O access token é emitido pelo Supabase Auth; a API só repassa o `expires_in` da sessão
(`Codigo/apps/api/src/supabase/supabase-auth.gateway.ts`). O padrão é **3600 s (1 h)** e a duração
é configurada no projeto Supabase, não na API. A API valida a expiração com o relógio do servidor
(`supabase-jwt.guard.ts`), e o app só renova quando recebe 401.

| Opção | Como | Observação |
| --- | --- | --- |
| **A (recomendada)** | Ficar **mais de 1 h** (ex.: 65 min) em modo avião. | Não altera nenhuma configuração. É o cenário real. |
| B (mais rápida) | No painel do Supabase do projeto **de desenvolvimento**, reduzir temporariamente a expiração do access token (JWT) para, por exemplo, 300 s; fazer login de novo no app (o token novo já sai com a duração curta); esperar mais que esse tempo em modo avião. | Afeta todos que usam o projeto de dev: avise a equipe e **volte para 3600 s** ao terminar. **Nunca em produção.** O nome e o local da opção variam com a versão do painel. |
| Não usar | Adiantar o relógio do aparelho. | Não expira nada (a validação é no servidor) e grava marcações com horário errado. |

Como confirmar: no log da API, ao voltar a rede, a primeira chamada autenticada responde 401 e em
seguida aparece `POST /api/auth/refresh`.

## Como forçar a recusa do refresh token (OF09)

`POST /api/auth/sair` encerra **todas** as sessões do usuário no Supabase (o `admin.signOut` do
`supabase-js` usa o escopo global por padrão). Com isso, o refresh token guardado no aparelho passa
a ser recusado. O access token do aparelho continua válido até expirar, porque a API o valida pela
assinatura; por isso OF09 também espera o token expirar.

Na máquina de desenvolvimento, você mesmo digita as credenciais do montador:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<e-mail do montador>","senha":"<senha>"}'
# copie o accessToken da resposta
curl -s -X POST http://localhost:3000/api/auth/sair -H "Authorization: Bearer <accessToken>"
```

---

## OF01 — Boot offline

**Pré-condições**
- APK release instalado; Montador do seed logado pelo menos uma vez **com rede**.
- Indicador em "Sincronizado agora" ou "Sincronizado há X".

**Passos**
1. Com rede, abra o app e confirme que a Jornada carrega com a obra e o último ponto.
2. Feche o app (remova dos recentes).
3. Ative o modo avião (Wi-Fi e dados desligados).
4. Abra o app.
5. Percorra Jornada (e o histórico e o banco de horas a partir dela), Avarias e Atestados.

**Resultado esperado**
- O app abre **direto na Jornada**, sem passar pelo Login.
- Indicador em "Sem conexão".
- Último ponto, obra para o ponto, histórico, banco de horas do mês, "MEUS REPORTES" e a lista de
  atestados aparecem com os dados locais. Os formulários de avaria e de atestado abrem.
- O botão "Bater ponto de entrada" (ou de saída) está disponível.

**Lado servidor**
- Nenhuma requisição chega à API durante os passos 4 e 5 (log da API parado).

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF02 — Ponto offline longo (mais de 1 h, token expira)

**Pré-condições**
- Montador **sem jornada aberta** no servidor (RH em `/espelho-ponto` do montador, ou tabela
  `jornada` sem linha com `checkout_at` vazio nas últimas 24 h). Com jornada aberta, o check-in é
  recusado com `JORNADA_EM_ANDAMENTO`.
- Localização dentro do raio da obra.
- App sincronizado com rede logo antes do teste.

**Passos**
1. Com rede, abra o app e aguarde "Sincronizado agora".
2. Ative o modo avião.
3. Espere o token expirar (seção "Como forçar o token a expirar"). O app pode ficar aberto ou
   fechado nesse tempo.
4. Escolha a obra e toque em "Bater ponto de entrada".
5. Alguns minutos depois, toque em "Bater ponto de saída".
6. Confira: o cartão do último ponto tem o selo "Sincronizando" e o indicador mostra
   "Sem conexão · 2 pendentes".
7. Com o app em primeiro plano, desligue o modo avião e reconecte.
8. Aguarde até 1 min.

**Resultado esperado**
- O indicador passa por "Sincronizando…" e chega a "Sincronizado agora", sem pendentes.
- O app **não** vai para o Login e não aparece "Uma ação não foi sincronizada".
- O selo "Sincronizando" some do cartão.
- Existe **uma** jornada com entrada e saída na Jornada e no histórico, sem duplicata.

**Lado servidor**
- Log da API: 401 na primeira chamada, depois `POST /api/auth/refresh`, os `POST
  /api/jornadas/checkin` e `/checkout` com sucesso e o `GET /api/sync/pull`.
- RH na Web: `/espelho-ponto` do montador mostra a jornada com os horários marcados offline.
- Prisma Studio, tabela `jornada`: uma linha com `checkin_id_cliente` e `checkout_id_cliente`
  preenchidos e `lancado_em_atraso = false`. Tabela `marcacao_ponto`: as duas marcações.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF03 — Avaria offline fora da aba Jornada, com 2 fotos

**Pré-condições**
- App sincronizado com rede (pedidos, peças e tipos de avaria na réplica).
- Câmera do aparelho ou emulador funcionando.

**Passos**
1. Com rede, abra o app e aguarde "Sincronizado agora".
2. Ative o modo avião.
3. Vá para a aba **Avarias** (não volte para a Jornada até o fim do cenário).
4. Preencha o formulário: pedido, peça, problema e descrição.
5. Anexe **2 fotos** pela câmera.
6. Feche o app, abra de novo e volte à aba Avarias: o rascunho, com as 2 fotos, continua lá.
7. Toque em "Enviar problema".
8. Confira em "MEUS REPORTES" a avaria com o selo "Aguardando envio" e o indicador com
   "Sem conexão · 1 pendente".
9. **Ainda na aba Avarias**, desligue o modo avião e reconecte.
10. Aguarde até 1 min.

**Resultado esperado**
- O formulário funciona sem rede.
- Depois do passo 9, a avaria sobe sem visitar a Jornada: o selo "Aguardando envio" troca para
  "Enviada" e o indicador chega a "Sincronizado agora".
- O formulário volta vazio depois do envio.

**Lado servidor**
- Gestor na Web: `/avarias` lista a avaria nova, com as 2 fotos.
- Prisma Studio: uma linha nova em `avaria` (`id_cliente` preenchido, status `REPORTADA`) e duas em
  `avaria_foto`.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF04 — Atestado offline

**Pré-condições**
- App sincronizado com rede logo antes do teste.

**Passos**
1. Com rede, abra o app e aguarde "Sincronizado agora".
2. Ative o modo avião.
3. Vá para a aba **Atestados**.
4. Informe "Data início", "Data fim" e "Observação"; anexe a foto do documento pela câmera.
5. Toque em "Enviar Atestado".
6. Confira na lista o atestado com o selo "Aguardando envio".
7. **Ainda na aba Atestados**, desligue o modo avião e reconecte.
8. Aguarde até 1 min.

**Resultado esperado**
- O formulário funciona sem rede e o atestado aparece na lista como "Aguardando envio".
- Com a rede de volta, o selo troca para "Em análise" (aguardando o RH) e o indicador chega a
  "Sincronizado agora".
- O formulário de atestado **não** guarda rascunho: se o app for fechado antes do envio, os campos
  e a foto se perdem (por decisão, dado de saúde).

**Lado servidor**
- RH na Web: `/atestados` mostra o atestado pendente, com a foto.
- Prisma Studio: uma linha nova em `atestado` (status `PENDENTE`) e as fotos em `atestado_foto`.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF05 — Mudança no servidor

### OF05a — Desalocação de obra

**Pré-condições**
- Montador atribuído a **dois** pedidos (o do seed e um segundo, criado pelo Gestor).
- Montador **sem jornada aberta** no pedido que será desalocado.
- App sincronizado: as duas obras aparecem na escolha da obra da Jornada e no campo de pedido do
  formulário de avaria.

**Passos**
1. Gestor na Web, em `/pedidos`: remova o montador de um dos pedidos e salve.
2. No app, com rede: mande o app para segundo plano e traga de volta (ou toque em "Atualizar").
3. Abra a escolha de obra da Jornada e o formulário de avaria.
4. Ative o modo avião e confira de novo.

**Resultado esperado**
- A obra desalocada **some** do app (escolha de obra e formulário de avaria), também em modo avião.
  A outra continua.
- Se a obra desalocada estava escolhida para o ponto ou no rascunho de avaria, ela deixa de
  aparecer como escolhida.

**Lado servidor**
- Prisma Studio, tabela `pedido_montador`: a atribuição foi removida.
- Tabela `sync_exclusao`: linhas com `entidade` = `pedidos` (id do pedido), `ambientes` e `pecas`
  (ids dos ambientes e peças dele), `usuario_id` = id do montador e `excluido_em` do momento da
  desalocação. Nenhuma linha para outros montadores do mesmo pedido.

### OF05b — Validação de avaria e atestado

**Pré-condições**
- Uma avaria e um atestado do montador já enviados (por exemplo, os de OF03 e OF04).

**Passos**
1. Gestor na Web, em `/avarias`: mude o status da avaria (por exemplo, para "Em análise").
2. RH na Web, em `/atestados`: valide o atestado (ou rejeite informando o motivo).
3. No app, com rede: mande o app para segundo plano e traga de volta.
4. Abra "MEUS REPORTES" na aba Avarias e a lista da aba Atestados.
5. Ative o modo avião e confira de novo.

**Resultado esperado**
- A avaria mostra "Em análise" (e o parecer do gestor, se houver); o atestado mostra "Aprovado"
  (ou "Recusado" com o motivo).
- Os novos status continuam visíveis em modo avião.

**Lado servidor**
- Prisma Studio: `avaria.status` e `atestado.status` com os novos valores e `updated_at` do
  momento da mudança.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF06 — Primeira instalação (janela do primeiro pull)

**Pré-condições**
- Aparelho ou emulador **sem** o app (desinstale, ou limpe os dados do app nas configurações do
  Android).
- De preferência, um montador com histórico mais antigo que as janelas (jornadas com mais de 30
  dias, avarias com mais de 30 dias, atestados com mais de 90 dias). O seed não cria histórico; sem
  ele, confira só a presença dos dados recentes.

**Passos**
1. Instale o APK release.
2. Com rede, faça login com o montador. O indicador passa de "Aguardando a primeira
   sincronização" a "Sincronizado agora".
3. Ative o modo avião.
4. Abra o histórico com o período de 30 dias, o banco de horas (mês atual e os 2 anteriores, e um
   mês mais antigo), "MEUS REPORTES" e a lista de Atestados; abra o formulário de avaria e a
   escolha de obra.

**Resultado esperado**

| Dado | Deve aparecer offline |
| --- | --- |
| Jornadas | as dos últimos 30 dias; mais antigas, não |
| Banco de horas | mês atual (recalculado pelo servidor a cada sincronização) e os 2 anteriores, se já calculados no servidor; mês mais antigo: "Sem dados offline para este mês" |
| Pedidos, ambientes e peças | todos os atribuídos ao montador |
| Tipos de avaria | todos |
| Avarias do montador | as dos últimos 30 dias |
| Atestados do montador | os dos últimos 90 dias |

**Lado servidor**
- RH na Web, `/espelho-ponto` do montador: as jornadas dos últimos 30 dias batem com as do app.
- Opcional: com o access token do montador (obtido como na seção "Como forçar a recusa do refresh
  token", sem chamar `/sair`), chame o pull sem `lastPulledAt` e compare as contagens:
  `curl -H "Authorization: Bearer <accessToken>" "http://localhost:3000/api/sync/pull?schemaVersion=2"`.
  Em `changes`, todas as linhas vêm em `updated`; `created` e `deleted` vêm vazios.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF07 — Troca de usuário

**Pré-condições**
- Dois montadores: A (o do seed) e B (criado pelo RH em `/montadores`), com obras diferentes.
- No aparelho, A logado e sincronizado, com jornadas e ao menos uma avaria enviada.

**Passos**
1. Com A logado, escolha uma obra para o ponto.
2. Comece uma avaria com 1 foto e **não envie** (fica como rascunho).
3. Ative o modo avião e registre outra avaria completa, que fica com "Aguardando envio".
4. **Ainda em modo avião**, toque em "Sair" na Jornada (o logout funciona sem rede).
5. Desligue o modo avião e faça login com B.
6. Percorra todas as abas.

**Resultado esperado**
- Nada de A aparece para B: jornadas, histórico, banco de horas, obras, "MEUS REPORTES",
  atestados, rascunho de avaria, fotos e a obra escolhida.
- O indicador de B começa sem pendentes.
- A avaria pendente de A **não** é enviada. É o comportamento definido: logout explícito descarta
  o que não foi enviado.

**Lado servidor**
- Gestor na Web, `/avarias`: a avaria do passo 3 **não** existe, nem em nome de A nem de B.
- Log da API: depois do login de B, nenhum `POST /api/avarias` ou `/api/jornadas/*`.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF08 — Reinício com pendências

**Pré-condições**
- Montador logado e sincronizado, sem jornada aberta, dentro do raio da obra.

**Passos**
1. Ative o modo avião.
2. Escolha a obra e toque em "Bater ponto de entrada"; registre uma avaria; comece outra avaria e
   deixe como rascunho.
3. Confira o selo "Sincronizando" no último ponto, "Aguardando envio" em "MEUS REPORTES" e o
   indicador com "Sem conexão · 2 pendentes".
4. Feche o app (remova dos recentes).
5. **Reinicie o aparelho** (ou faça *Cold Boot* do emulador). Mantenha o modo avião.
6. Abra o app.
7. Desligue o modo avião e reconecte.

**Resultado esperado**
- Depois do reinício, o app abre na Jornada sem Login e com as mesmas pendências, a obra escolhida
  e o rascunho de avaria (com a foto).
- Com a rede de volta, as duas ações sobem e o indicador chega a "Sincronizado agora". O rascunho
  continua lá.

**Lado servidor**
- Prisma Studio: a jornada (`jornada`, com `checkin_id_cliente`) e a avaria (`avaria`, com
  `id_cliente`) existem.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF09 — Expiração forçada da sessão com ações na fila

**Pré-condições**
- Dois montadores, A e B (como em OF07). A sem jornada aberta, dentro do raio da obra.
- A logado e sincronizado.

**Passos — parte 1: mesmo montador**
1. Ative o modo avião no aparelho.
2. Escolha a obra, toque em "Bater ponto de entrada" e comece um rascunho de avaria com 1 foto.
3. Na máquina de desenvolvimento, encerre as sessões de A (seção "Como forçar a recusa do refresh
   token").
4. Espere o access token do aparelho expirar (seção "Como forçar o token a expirar").
5. Desligue o modo avião e reconecte, com o app em primeiro plano.
6. Faça login de novo com **A**.

**Resultado esperado — parte 1**
- No passo 5, o app volta para o Login (o refresh foi recusado).
- No passo 6, a obra escolhida e o rascunho com a foto continuam lá; a entrada sobe e aparece uma
  única jornada. Indicador em "Sincronizado agora".

**Passos — parte 2: outro montador**
1. Repita os passos 1 a 5 da parte 1 com A.
2. No Login, entre com **B**.

**Resultado esperado — parte 2**
- Nada de A aparece para B (réplica, fila, rascunho, fotos, obra escolhida).
- A entrada de A **não** é enviada.

**Lado servidor**
- Parte 1: log da API com `POST /api/auth/refresh` recusado e, depois do login, `POST
  /api/jornadas/checkin` com sucesso. Tabela `jornada`: a jornada de A com `checkin_id_cliente`.
- Parte 2: nenhuma jornada nova de A no horário da marcação; nenhum `POST /api/jornadas/checkin`
  depois do login de B.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## Checagens em aparelho

Pontos que os testes automatizados não cobrem (rodam com LokiJS e mocks).

### CA01 — Foto da galeria (`content://`) no Android

**Passos**
1. Em Avarias, anexe uma foto pela **galeria** (não pela câmera). Repita em Atestados.
2. Confira a miniatura no formulário.
3. Envie com rede e, em outro teste, em modo avião seguido de reconexão.

**Resultado esperado**
- A miniatura aparece (a cópia da URI `content://` para a pasta `fotos_pendentes` funcionou).
- A foto chega ao servidor (`avaria_foto` / `atestado_foto`) e abre na Web.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

### CA02 — Migração do banco local v2 → v3

**Pré-condições**
- Um aparelho com um APK do schema local v2, gerado do commit `c14220d` da branch de integração
  (antes de #112). Montador logado, com jornadas no histórico e **uma ação pendente** feita
  offline (por exemplo, um check-in).

**Passos**
1. Em modo avião, instale por cima o APK novo (`adb install -r`, mantendo os dados).
2. Abra o app.
3. Desligue o modo avião e reconecte.

**Resultado esperado**
- O app abre sem erro e sem pedir login de novo (a sessão `mc.sessao.v2` e o dono da fila já
  existiam nessa versão). A ação pendente continua na fila.
- Com a rede, a ação sobe e o histórico volta sem jornadas duplicadas.

Aparelhos que vêm da `main` atual (schema local v1, sessão `mc.sessao.v1`) migram v1 → v2 → v3 de
uma vez. Neles o montador precisa entrar de novo, e uma fila com ações sem dono conhecido é apagada
no login (regra de falha fechada). Se possível, repita CA02 com um APK da `main` e registre o
resultado na issue.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

### CA03 — Lacuna offline logo após a atualização

**Passos**
1. Continue do passo 2 de CA02, ainda em modo avião (antes de qualquer pull).
2. Abra o histórico e o banco de horas.

**Resultado esperado**
- Histórico e banco de horas aparecem vazios ou com "Sem dados offline para este mês": a migração
  v3 apagou essas tabelas e só o primeiro pull com rede as preenche. O ponto continua funcionando.
- Depois de reconectar e sincronizar, os dados voltam.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## Solução de problemas

| Sintoma | Causa provável e o que fazer |
| --- | --- |
| Abre no Login mesmo com sessão anterior | Sessão salva no formato antigo (`mc.sessao.v1`) ou sessão encerrada. Faça login uma vez com rede e repita. |
| A rede voltou e o indicador continua em "Sem conexão" ou "Servidor sem resposta" | API inacessível pelo aparelho (IP, porta 3000, firewall) ou Wi-Fi marcado como "sem internet". Abra o endereço da API no navegador do aparelho; mande o app para segundo plano e traga de volta. |
| Voltou ao Login depois de reconectar | O servidor recusou o refresh token (expiração forçada). A fila é mantida: entre de novo com o **mesmo** montador e as ações sobem. Com outro usuário, ela é apagada. |
| "Uma ação não foi sincronizada" com "Ação recusada: REGISTRO_FORA_DA_JANELA." | A marcação é de antes de ontem ou o relógio do aparelho está errado. Lance como ponto em atraso. |
| "Ação recusada: FORA_DO_RAIO_TOLERADO." ou "PEDIDO_INVALIDO" | Localização a mais de 200 m do cliente, ou obra não atribuída ao montador. |
| "Ação recusada: JORNADA_EM_ANDAMENTO." | O montador já tinha jornada aberta no servidor. Encerre-a e repita. |
| Indicador "Atualize o aplicativo para sincronizar" | A API respondeu 426 (`VERSAO_SCHEMA_INCOMPATIVEL`): app e API de versões diferentes. Gere o APK da mesma branch da API. |
| Indicador "Falha ao sincronizar" | Erro inesperado no pull ou no banco local. Veja o log da API e o `adb logcat`, e registre na issue. |
| App debug não abre em modo avião | Build debug depende do Metro. Use o APK release. |
| Build quebra | Ver `Codigo/apps/mobile/BUILD-APK.md`, seção 11. Se a causa for o WatermelonDB ou o plugin `@lovesworking/watermelondb-expo-plugin-sdk-52-plus` depois de atualizar Expo ou React Native, registre na issue: é o critério de saída para `expo-sqlite` + Drizzle. |
