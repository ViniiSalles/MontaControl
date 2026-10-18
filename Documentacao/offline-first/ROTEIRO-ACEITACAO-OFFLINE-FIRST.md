# Roteiro de aceitação: offline-first no aplicativo mobile

Cenários da issue #115 (épico #105), para executar em **aparelho físico ou emulador Android em
modo avião**. A decisão de arquitetura testada aqui está em
[`DECISAO-ARQUITETURA-OFFLINE-FIRST.md`](./DECISAO-ARQUITETURA-OFFLINE-FIRST.md).

Este roteiro **ainda não foi executado**. Quem executar marca o resultado de cada cenário e anexa a
evidência (prints ou vídeo curto) na issue #115.

## Cenários e dependências

Alguns cenários dependem de issues ainda em implementação quando este roteiro foi escrito. Execute
o roteiro completo só depois que #112, #113 e #114 estiverem na branch de integração
`feat/offline-first-epico-105`.

| Id | Cenário | Depende de |
| --- | --- | --- |
| OF01 | Boot offline | #106 |
| OF02 | Ponto offline longo (token expira) | #106, #107; #112 para "sem jornada duplicada" |
| OF03 | Avaria offline fora da aba Jornada, com 2 fotos | #107, #113 |
| OF04 | Atestado offline | #113 |
| OF05 | Mudança no servidor (desalocação e validação) | #109, #110, #112; #113 para status de avaria e atestado |
| OF06 | Primeira instalação (janela do primeiro pull) | #110, #112 |
| OF07 | Troca de usuário | #106, #112; #113 (fotos) e #114 (rascunhos) |
| OF08 | Reinício com pendências | #106; #114 para obra escolhida e rascunho |

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
- Para OF05 e OF07 é preciso um segundo pedido atribuído ao montador e um **segundo montador**.
  Crie pela Web: o RH cadastra montadores (`/montadores`); o Gestor cadastra clientes
  (`/clientes`), pedidos e atribui montadores (`/pedidos`).
- Para consultar o lado servidor sem montar requisições: `pnpm --filter @montacontrol/api
  prisma:studio` (abre as tabelas do banco de dev no navegador; use só para leitura).

### Web

`pnpm --filter @montacontrol/web dev`. Telas usadas: Gestor em `/pedidos`, `/clientes` e
`/avarias`; RH em `/atestados`, `/montadores` e `/espelho-ponto`.

### Aplicativo

- **Use um APK release**, gerado conforme `Codigo/apps/mobile/BUILD-APK.md` (seções 5 a 9). O JS
  vai embutido no APK. Um build debug (ou `pnpm android`) busca o JS no Metro pela rede: fechado e
  reaberto em modo avião, ele não carrega, e o teste de boot offline perde o sentido. O Expo Go não
  serve (o WatermelonDB tem módulo nativo).
- **Endereço da API:** no emulador Android o padrão `http://10.0.2.2:3000` já funciona. Em aparelho
  físico, ajuste `expo.extra.apiUrl` no `app.json` para o IP da máquina na rede local e recompile
  (`BUILD-APK.md`, seção 9). Não commite essa alteração. Libere a porta 3000 no firewall.
- **Localização:** o ponto só é aceito a até 200 m das coordenadas do cliente da obra
  (`RAIO_TOLERANCIA_PONTO_METROS`).
  - Emulador: em *Extended controls → Location*, defina a posição do "Cliente Demonstração"
    (coordenadas em `seed.ts`) ou do cliente da obra usada.
  - Aparelho físico: o Gestor cadastra um cliente com as coordenadas do local do teste e um pedido
    atribuído ao montador. O GPS funciona em modo avião, mas a primeira leitura pode demorar; fique
    perto de uma janela.
- **Relógio do aparelho:** mantenha automático. A API aceita marcação de ponto só do dia corrente e
  do dia anterior (`REGISTRO_FORA_DA_JANELA`) e usa o horário registrado no aparelho.
- **Voltar a rede:** desligar o modo avião e reconectar ao Wi-Fi da mesma rede da API. Em Wi-Fi
  sem acesso à internet o Android pode marcar a conexão como "sem internet", e o gatilho de volta da
  rede não dispara; nesse caso, mande o app para segundo plano e traga de volta (o retorno ao
  primeiro plano também sincroniza).

## Como forçar o token a expirar (OF02)

O access token é emitido pelo Supabase Auth; a API só repassa o `expires_in` da sessão
(`Codigo/apps/api/src/supabase/supabase-auth.gateway.ts`). O padrão é **3600 s (1 h)** e a duração
é configurada no projeto Supabase, não na API. A API valida a expiração com o relógio do servidor
(`supabase-jwt.guard.ts`), e o app só renova quando recebe 401.

| Opção | Como | Observação |
| --- | --- | --- |
| **A (recomendada)** | Ficar **mais de 1 h** (ex.: 65 min) em modo avião. | Não altera nenhuma configuração. É o cenário real. |
| B (mais rápida) | No painel do Supabase do projeto **de desenvolvimento**, reduzir temporariamente a expiração do access token (JWT) para, por exemplo, 300 s; fazer login de novo no app (o token novo já sai com a duração curta); esperar mais que esse tempo em modo avião. | Afeta todos que usam o projeto de dev: avise a equipe e **volte para 3600 s** ao terminar. **Nunca em produção.** O nome e o local da opção variam com a versão do painel. |
| Não usar | Adiantar o relógio do aparelho. | Não expira nada (a validação é no servidor) e grava marcações com horário errado. |

Como confirmar que o token expirou de fato: no log da API, ao voltar a rede, a primeira chamada
autenticada responde 401 e em seguida aparece `POST /api/auth/refresh`.

---

## OF01 — Boot offline

**Pré-condições**
- APK release instalado; Montador do seed logado pelo menos uma vez **com rede**.
- Primeira sincronização concluída: a Jornada mostra o último ponto e a obra disponível.

**Passos**
1. Com rede, abra o app e confirme que a Jornada carrega.
2. Feche o app (remova dos recentes).
3. Ative o modo avião (Wi-Fi e dados desligados).
4. Abra o app.
5. Percorra as abas Jornada, Histórico e Banco de horas.

**Resultado esperado**
- O app abre **direto na Jornada**, sem passar pelo Login e sem mensagem de erro bloqueante.
- Último ponto, obra para o ponto e histórico aparecem com os dados locais.
- Os botões de ponto estão disponíveis.

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
- Localização dentro do raio da obra (ver pré-requisitos).
- App sincronizado com rede logo antes do teste.

**Passos**
1. Com rede, abra o app e aguarde a sincronização.
2. Ative o modo avião.
3. Espere o token expirar (seção "Como forçar o token a expirar"). O app pode ficar aberto ou
   fechado nesse tempo.
4. Bata a **entrada**, escolhendo a obra.
5. Alguns minutos depois, bata a **saída**.
6. Confira que o último ponto mostra a marcação como pendente de envio (selo de sincronização).
7. Com o app em primeiro plano, desligue o modo avião e reconecte.
8. Aguarde até 1 min e use "Atualizar" na Jornada.

**Resultado esperado**
- As duas marcações chegam ao servidor; nenhuma mensagem de "ação recusada".
- O app **não** vai para o Login.
- O selo de pendência some.
- Existe **uma** jornada com entrada e saída, sem duplicata (conforme a issue #112, em
  implementação).

**Lado servidor**
- Log da API: 401 na primeira chamada, depois `POST /api/auth/refresh` e os `POST
  /api/jornadas/checkin` e `/checkout` com sucesso.
- RH na Web: `/espelho-ponto` do montador mostra a jornada com os horários marcados offline.
- Prisma Studio, tabela `jornada`: uma linha com `checkin_id_cliente` e `checkout_id_cliente`
  preenchidos e `lancado_em_atraso = false`. Tabela `marcacao_ponto`: as duas marcações.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF03 — Avaria offline fora da aba Jornada, com 2 fotos

**Pré-condições**
- Réplica preenchida com rede: pedidos, ambientes, peças e tipos de avaria (conforme as issues #112
  e #113, em implementação).
- Câmera do aparelho ou emulador funcionando.

**Passos**
1. Com rede, abra o app e aguarde a sincronização.
2. Ative o modo avião.
3. Vá para a aba **Avarias** (não volte para a Jornada até o fim do cenário).
4. Preencha o formulário: pedido, peça, tipo de avaria e descrição.
5. Anexe **2 fotos** e envie.
6. Confira em "Meus reportes" a avaria com o selo "Aguardando envio".
7. **Ainda na aba Avarias**, desligue o modo avião e reconecte.
8. Aguarde até 1 min.

**Resultado esperado**
- O formulário abre sem rede (não aparece "Não foi possível carregar").
- Depois do passo 7, a avaria sobe sem visitar a Jornada e o selo "Aguardando envio" some.

**Lado servidor**
- Gestor na Web: `/avarias` lista a avaria nova, com as 2 fotos.
- Prisma Studio: uma linha nova em `avaria` (`id_cliente` preenchido, status `REPORTADA`) e duas em
  `avaria_foto`.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## OF04 — Atestado offline

**Pré-condições**
- Envio de atestado pela fila, conforme a issue #113 (em implementação).
- App sincronizado com rede logo antes do teste.

**Passos**
1. Com rede, abra o app e aguarde a sincronização.
2. Ative o modo avião.
3. Vá para a aba **Atestados** e abra um novo atestado.
4. Informe data de início, data de fim e observação; anexe a foto do documento; envie.
5. Confira na lista o atestado com o selo "Aguardando envio".
6. **Ainda na aba Atestados**, desligue o modo avião e reconecte.
7. Aguarde até 1 min.

**Resultado esperado**
- O formulário funciona sem rede e o atestado aparece na lista como pendente.
- Com a rede de volta, o atestado sobe e o selo some; o status mostrado é `PENDENTE` (aguardando o
  RH).

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
- App sincronizado: as duas obras aparecem na escolha da obra para o ponto e no formulário de
  avaria.

**Passos**
1. Gestor na Web, em `/pedidos`: remova o montador de um dos pedidos e salve.
2. No app, com rede: mande o app para segundo plano e traga de volta (ou use "Atualizar").
3. Abra a escolha de obra da Jornada e o formulário de avaria.

**Resultado esperado**
- A obra desalocada **some** do app (escolha de obra e formulário de avaria). A outra continua.

**Lado servidor**
- Prisma Studio, tabela `pedido_montador`: a atribuição foi removida.
- Tabela `sync_exclusao`: linhas com `entidade` = `pedidos` (id do pedido), `ambientes` e `pecas`
  (ids dos ambientes e peças dele), `usuario_id` = id do montador e `excluido_em` do momento da
  desalocação. Nenhuma linha para outros montadores do mesmo pedido.

### OF05b — Validação de avaria e atestado

**Pré-condições**
- Uma avaria e um atestado do montador já enviados (por exemplo, os de OF03 e OF04) e visíveis no
  app.

**Passos**
1. Gestor na Web, em `/avarias`: mude o status da avaria (por exemplo, para `EM_ANALISE`).
2. RH na Web, em `/atestados`: valide o atestado (ou rejeite informando o motivo).
3. No app, com rede: mande o app para segundo plano e traga de volta.
4. Abra "Meus reportes" na aba Avarias e a lista da aba Atestados.

**Resultado esperado**
- A avaria mostra o novo status; o atestado mostra `VALIDADO` (ou `REJEITADO` com o motivo).
- Os novos status continuam visíveis depois de ativar o modo avião.

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
2. Com rede, faça login com o montador e aguarde a primeira sincronização.
3. Ative o modo avião.
4. Abra Histórico com o período de 30 dias, Banco de horas (mês atual e os 2 anteriores), "Meus
   reportes" em Avarias e a lista de Atestados; abra o formulário de avaria e a escolha de obra.

**Resultado esperado**

| Dado | Deve aparecer offline |
| --- | --- |
| Jornadas | as dos últimos 30 dias; mais antigas, não |
| Banco de horas | mês atual e os 2 anteriores, se já calculados no servidor |
| Pedidos, ambientes e peças | todos os atribuídos ao montador |
| Tipos de avaria | todos |
| Avarias do montador | as dos últimos 30 dias |
| Atestados do montador | os dos últimos 90 dias |

**Lado servidor**
- RH na Web, `/espelho-ponto` do montador: as jornadas dos últimos 30 dias batem com as do app.
- Opcional: com um access token do montador (obtido por você em `POST /api/auth/login`), chame o
  pull sem `lastPulledAt` e compare as contagens com o app:
  `curl -H "Authorization: Bearer <access_token>" "http://localhost:3000/api/sync/pull?schemaVersion=2"`.
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
2. Comece uma avaria com 1 foto e **não envie** (fica como rascunho, conforme a issue #114, em
   implementação).
3. Ative o modo avião e registre uma avaria completa, que fica na fila como "Aguardando envio".
4. **Ainda em modo avião**, toque em **Sair** (o logout funciona sem rede).
5. Desligue o modo avião e faça login com B.
6. Percorra todas as abas.

**Resultado esperado**
- Nada de A aparece para B: jornadas, histórico, banco de horas, obras, avarias, atestados,
  rascunho de avaria, fotos e a obra escolhida.
- O contador de pendências de B começa zerado.
- A avaria pendente de A **não** é enviada com a sessão de B. Isso é o comportamento definido:
  logout explícito descarta o que não foi enviado.

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
2. Bata a **entrada** e registre uma avaria (se #113 já estiver na branch).
3. Confira as pendências na tela (selo de sincronização ou "Aguardando envio").
4. Feche o app (remova dos recentes).
5. **Reinicie o aparelho** (ou faça *Cold Boot* do emulador). Mantenha o modo avião.
6. Abra o app.
7. Confira que as pendências continuam na tela.
8. Desligue o modo avião e reconecte.

**Resultado esperado**
- Depois do reinício, o app abre na Jornada sem Login e com as mesmas pendências (nada sumiu).
- A obra escolhida e o rascunho de avaria continuam lá (conforme a issue #114, em implementação).
- Com a rede de volta, todas as ações sobem.

**Lado servidor**
- Prisma Studio: a jornada (`jornada`, com `checkin_id_cliente`) e a avaria (`avaria`, com
  `id_cliente`) existem.

**Resultado:** ☐ Passou ☐ Falhou

**Evidência (print/vídeo — anexar na issue #115):**

---

## Solução de problemas

| Sintoma | Causa provável e o que fazer |
| --- | --- |
| Abre no Login mesmo com sessão anterior | Sessão salva no formato antigo (`mc.sessao.v1`) ou sessão encerrada. Faça login uma vez com rede e repita. |
| A rede voltou e nada sobe | API inacessível pelo aparelho (IP, porta 3000, firewall) ou Wi-Fi marcado como "sem internet". Abra o endereço da API no navegador do aparelho; mande o app para segundo plano e traga de volta. |
| Voltou ao Login depois de reconectar | O servidor recusou o refresh token (expiração forçada). A fila é mantida: entre de novo com o **mesmo** montador e as ações sobem. Com outro usuário, ela é apagada. |
| "Ação recusada: REGISTRO_FORA_DA_JANELA" | A marcação é de antes de ontem ou o relógio do aparelho está errado. Lance como ponto em atraso. |
| "Ação recusada: FORA_DO_RAIO_TOLERADO" ou `PEDIDO_INVALIDO` | Localização a mais de 200 m do cliente, ou obra não atribuída ao montador. |
| "Ação recusada: JORNADA_EM_ANDAMENTO" | O montador já tinha jornada aberta no servidor. Encerre-a e repita. |
| Pull responde 426 `VERSAO_SCHEMA_INCOMPATIVEL` | App e API de versões diferentes. Gere o APK da mesma branch da API. |
| App debug não abre em modo avião | Build debug depende do Metro. Use o APK release. |
| Build quebra | Ver `Codigo/apps/mobile/BUILD-APK.md`, seção 11. Se a causa for o WatermelonDB ou o plugin `@lovesworking/watermelondb-expo-plugin-sdk-52-plus` depois de atualizar Expo ou React Native, registre na issue: é o critério de saída para `expo-sqlite` + Drizzle. |
