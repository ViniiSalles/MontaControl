# Sprint 2 — Check-in com GPS e histórico de pontos

**Data:** 2026-08-29
**Issues:** #16 (check-in com captura de geolocalização), #19 (consulta de banco de horas)
**Branch base:** `feature/mobile-config`

---

## 1. Escopo

Duas entregas que compartilham a mesma fonte de dados (a tabela `jornada`) e a mesma camada offline:

1. **Check-in / check-out com GPS** — o montador registra início e fim de jornada capturando
   latitude/longitude do aparelho. A tela mostra um mapa da região (tiles OpenStreetMap) e o endereço
   resolvido por reverse geocoding no Nominatim, além das coordenadas em exibição.
2. **Histórico de pontos** — tela alcançada **a partir da tela de check-in**, com filtro de período
   (5, 15 ou 30 dias) listando um card por dia com hora de início, hora de fim e total trabalhado.

### Decisões tomadas no brainstorming

| Decisão | Escolha |
| --- | --- |
| Escopo | Backend (NestJS + Prisma) **e** mobile |
| Mapa | Tiles OSM + Leaflet dentro de `react-native-webview`; Nominatim só para o endereço |
| Fonte do histórico | Derivado das jornadas — a tabela `banco_horas` (agregado mensal) fica fora |
| Offline-first | Entra agora: WatermelonDB com outbox **e** espelho local das jornadas |
| Endereço offline | Persistido junto do registro; resolvido depois quando a rede voltar |
| Navegação | Histórico **não** é aba nem irmão da Jornada — é uma tela filha da tela de check-in |

### Fora de escopo

- Tabela `banco_horas` e rotina de cálculo do agregado mensal (saldo, horas previstas).
- `model Pausa` — não há UI de pausa nesta sprint, então pausas **não** são descontadas do total do
  dia. Documentado como limitação conhecida.
- `pedidoId` na jornada: check-in não é vinculado a pedido nesta sprint (`pedido_id` fica `null`).
- `POST /api/sync` (push genérico do protocolo WatermelonDB). As escritas passam pelos endpoints de
  domínio; só o **pull** usa o protocolo.
- Abas `bipagem`, `avarias`, `atestados`, `normas` continuam `disponivel: false`.

---

## 2. Arquitetura de sincronização

Escolha: **pull pelo protocolo do WatermelonDB, push pela outbox de domínio.**

```
                    ┌──────────────── pull (GET /api/sync) ────────────────┐
                    ▼                                                      │
  tabela local `jornada`  ◄── espelho read-only ───────────────── API (fonte da verdade)
                                                                           ▲
  tabela local `outbox`  ── drenagem ──► POST /api/jornadas/checkin ────────┘
                                         POST /api/jornadas/checkout
```

**Por que não o push genérico do protocolo:** check-in tem regra de negócio (uma jornada aberta por
vez, janela de tempo válida, idempotência). Um endpoint que aceita linhas cruas teria de
re-implementar essas regras fora do `JornadasService`. Drenando a outbox contra os endpoints de
domínio, a regra vive num lugar só.

**Por que a outbox e não um simples retry:** `StatusOutbox` (definido na Sprint 1) existe justamente
para distinguir os dois modos de falha que o protótipo confundia:

- **Falha de rede / 5xx** → permanece `PENDENTE`, será retentada.
- **Recusa 4xx** (regra violada, payload inválido) → vira `DESCARTADO`, nunca é retentada, e a UI
  informa o montador. Retentar um 4xx para sempre é o bug que o enum foi criado para impedir.

---

## 3. Contratos compartilhados (`packages/shared`)

### 3.1 `src/types.ts` — alterações

`CheckinRequest` ganha dois campos:

```ts
export interface CheckinRequest {
  /**
   * UUID gerado no aparelho. É a chave de idempotência da outbox: se a
   * resposta do POST se perder na rede, a retentativa carrega o mesmo id e
   * o servidor devolve a jornada já criada em vez de criar uma segunda.
   */
  idCliente: string;
  latitude: number;
  longitude: number;
  /** Timestamp do dispositivo — relevante em operação offline-first. */
  registradoEm: string;
  /** Endereço resolvido pelo Nominatim; ausente quando o check-in foi feito offline. */
  endereco?: string;
}

export interface CheckoutRequest {
  idCliente: string;
  latitude: number;
  longitude: number;
  registradoEm: string;
  endereco?: string;
}
```

`JornadaDTO` passa a carregar as coordenadas e endereços (a tela precisa deles para redesenhar o
mapa do check-in em andamento sem nova captura de GPS):

```ts
export interface JornadaDTO {
  id: number;
  usuarioId: number;
  status: StatusJornada;
  checkinAt: string | null;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkinEndereco: string | null;
  checkoutAt: string | null;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  checkoutEndereco: string | null;
}
```

Novos tipos do histórico:

```ts
/** Períodos oferecidos pelo seletor da tela de histórico. */
export type PeriodoHistorico = 5 | 15 | 30;

export interface DiaJornadaDTO {
  /** `YYYY-MM-DD` no fuso de operação (`America/Sao_Paulo`), não em UTC. */
  data: string;
  /** Menor `checkinAt` do dia, ISO 8601. `null` só em dia sem check-in registrado. */
  inicio: string | null;
  /** Maior `checkoutAt` do dia. `null` enquanto a última jornada do dia estiver aberta. */
  fim: string | null;
  minutosTrabalhados: number;
  /** Alguma jornada do dia sem check-out. */
  emAndamento: boolean;
  jornadas: JornadaDTO[];
}

export interface HistoricoJornadasDTO {
  periodoDias: PeriodoHistorico;
  inicioPeriodo: string; // YYYY-MM-DD
  fimPeriodo: string; // YYYY-MM-DD
  /** Só dias com ao menos uma jornada, do mais recente para o mais antigo. */
  dias: DiaJornadaDTO[];
  totalMinutos: number;
}
```

`dias` **não** inclui dias vazios: 30 cards em branco não informam nada e empurram os dias
trabalhados para fora da tela.

### 3.2 `src/jornadas/agruparPorDia.ts` — função pura compartilhada

O agrupamento por dia acontece em dois lugares: no servidor (para responder `GET
/jornadas/historico`) e no aparelho (para montar a mesma tela lendo o banco local, offline). Duas
implementações divergiriam na primeira mudança de regra — especialmente no tratamento de fuso.

```ts
export function agruparJornadasPorDia(
  jornadas: readonly JornadaDTO[],
  fuso: string,
): DiaJornadaDTO[];
```

Função pura, sem dependência de runtime, usando `Intl.DateTimeFormat(fuso, ...)` para derivar o dia.
Regras:

- O dia de uma jornada é o dia do **check-in** no fuso informado. Jornada que cruza a meia-noite
  conta inteira no dia em que começou.
- `minutosTrabalhados` de uma jornada = `checkoutAt - checkinAt` arredondado ao minuto. Jornada sem
  check-out contribui `0` e marca `emAndamento`.
- Ordenação decrescente por data.

---

## 4. Backend

### 4.1 Migração Prisma

`model Jornada` ganha:

```prisma
  checkinIdCliente  String?  @unique @map("checkin_id_cliente") @db.Uuid
  checkoutIdCliente String?  @unique @map("checkout_id_cliente") @db.Uuid
  checkinEndereco   String?  @map("checkin_endereco")
  checkoutEndereco  String?  @map("checkout_endereco")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@index([usuarioId, checkinAt])
```

- Os dois `idCliente` são anuláveis porque uma jornada criada fora do app (seed, correção manual)
  não tem um. No Postgres, `UNIQUE` permite múltiplos `NULL`, então isso não colide.
- `updatedAt` é o cursor do pull do WatermelonDB (`lastPulledAt`). Sem ele o pull teria de trazer
  tudo sempre.
- O índice `(usuarioId, checkinAt)` serve tanto ao histórico quanto à busca da jornada aberta.

Migração via `pnpm --filter @montacontrol/api prisma:migrate:dev --name jornada_checkin_gps`. Sem
alteração manual no banco.

### 4.2 Módulo `apps/api/src/jornadas/`

Camadas obrigatórias `Controller → Service → Repository → Prisma`, um repositório para o agregado
Jornada.

```
apps/api/src/jornadas/
├── jornadas.module.ts
├── jornadas.controller.ts
├── jornadas.controller.spec.ts
├── jornadas.service.ts
├── jornadas.service.spec.ts
├── jornadas.repository.ts
├── jornada-mapper.ts               # linha Prisma → JornadaDTO (Decimal → number)
├── dto/
│   ├── checkin.dto.ts
│   ├── checkout.dto.ts
│   └── historico.query.dto.ts
└── exceptions/
    ├── jornada-em-andamento.exception.ts
    ├── sem-jornada-aberta.exception.ts
    ├── checkout-antes-do-checkin.exception.ts
    └── registro-fora-da-janela.exception.ts
```

Exceções seguem o padrão de `CredenciaisInvalidasException`: `HttpException` com propriedade
`codigo`, que o `HttpExceptionFilter` já extrai para o corpo `{ codigo, message }`.

`jornadas.module.ts` é importado por `AppModule`. Os guards `SupabaseJwtGuard` e `RolesGuard` já são
`APP_GUARD` globais (registrados em `AuthModule`), então todo endpoint novo nasce autenticado; basta
`@Roles(Perfil.MONTADOR)` no controller.

### 4.3 Endpoints

Prefixo global `api`, controller `@Controller('jornadas')`, todo o controller com
`@Roles(Perfil.MONTADOR)`.

| Método | Rota | Sucesso | Erros de domínio |
| --- | --- | --- | --- |
| `POST` | `/api/jornadas/checkin` | `201` `JornadaDTO` | `409 JORNADA_EM_ANDAMENTO`, `400 REGISTRO_FORA_DA_JANELA` |
| `POST` | `/api/jornadas/checkout` | `200` `JornadaDTO` | `409 SEM_JORNADA_ABERTA`, `400 CHECKOUT_ANTES_DO_CHECKIN`, `400 REGISTRO_FORA_DA_JANELA` |
| `GET` | `/api/jornadas/atual` | `200` `JornadaDTO \| null` | — |
| `GET` | `/api/jornadas/historico?dias=5\|15\|30` | `200` `HistoricoJornadasDTO` | `400` (validação) |
| `GET` | `/api/sync?lastPulledAt=<ms>` † | `200` `SyncPullResponse` | — |

† `GET /api/sync` não pertence ao `JornadasController` — mora em `apps/api/src/sync/`
(`SyncController` + `SyncService`), que consome o `JornadasRepository`. Aparece aqui só para a
tabela mostrar a superfície HTTP inteira da sprint.

**Regras de `checkin`:**

1. Se já existe jornada do usuário com `checkinIdCliente = dto.idCliente`, devolve **essa** jornada
   (`201`) sem criar outra — retentativa da outbox é idempotente.
2. Senão, se existe jornada do usuário com status `EM_ANDAMENTO` ou `PAUSADA` → `409
   JORNADA_EM_ANDAMENTO`.
3. `checkinAt = dto.registradoEm` (timestamp do aparelho, porque o check-in pode ter sido feito
   offline horas antes). Rejeita com `REGISTRO_FORA_DA_JANELA` se estiver mais de **5 minutos no
   futuro** ou mais de **7 dias no passado** — relógio de aparelho errado não pode gravar jornada
   arbitrária.
4. Cria com `status = EM_ANDAMENTO`, `pedidoId = null`.

**Regras de `checkout`:**

1. Idempotente por `checkoutIdCliente`, mesma lógica do item 1 acima.
2. Sem jornada `EM_ANDAMENTO`/`PAUSADA` do usuário → `409 SEM_JORNADA_ABERTA`.
3. `registradoEm < checkinAt` → `400 CHECKOUT_ANTES_DO_CHECKIN`.
4. Grava coordenadas/endereço de saída e move o status para `FINALIZADA`.

**`historico`:** `dias` validado com `@IsIn([5, 15, 30])` + `@Type(() => Number)`. O período é
calculado no fuso `America/Sao_Paulo`: `fimPeriodo` = hoje, `inicioPeriodo` = hoje − (dias − 1). O
service busca as jornadas do usuário nesse intervalo e delega a `agruparJornadasPorDia`.

**`sync`:** controller próprio (`apps/api/src/sync/`), devolve
`{ changes: { jornada: { created, updated, deleted: [] } }, timestamp }` filtrado pelo usuário
autenticado. `deleted` é sempre vazio — jornada não é apagada. `created` vs `updated` é decidido por
`createdAt > lastPulledAt`.

### 4.4 Fuso de operação

`apps/api/src/common/fuso.ts` exporta `export const FUSO_OPERACAO = 'America/Sao_Paulo';`. O mobile
tem a constante espelhada. Agrupar em UTC colocaria um check-in das 21h de terça no dia de quarta —
o card do dia sairia errado para toda jornada noturna.

---

## 5. Mobile — dependências e build

Novas dependências (instaladas com `expo install` para casar com o SDK 57):

| Pacote | Para quê |
| --- | --- |
| `expo-location` | permissão e captura de coordenadas |
| `react-native-webview` | hospedar o Leaflet do `MapaLocalizacao` |
| `@nozbe/watermelondb` | banco local (espelho + outbox) |
| `@react-native-community/netinfo` | disparar a drenagem da outbox quando a rede volta |
| `expo-crypto` | `randomUUID()` para o `idCliente` |
| `expo-dev-client` (dev) | rodar o app com módulos nativos |

**O app deixa de rodar no Expo Go.** WatermelonDB é módulo nativo (JSI), então a partir desta sprint
o fluxo é `expo prebuild` + `eas build --profile development` / `expo run:android`. O README do
mobile já antecipava esse prebuild; a seção de execução precisa ser reescrita.

WatermelonDB exige `@babel/plugin-proposal-decorators` (legacy) no `babel.config.js` e
`experimentalDecorators` no `tsconfig` do app.

`app.json`:

```jsonc
{
  "plugins": [
    "expo-font",
    "expo-splash-screen",
    "expo-dev-client",
    ["expo-location", {
      "locationWhenInUsePermission": "O MontaControl registra sua localização no momento do check-in e do check-out da jornada."
    }]
  ],
  "android": { "permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"] },
  "ios": { "infoPlist": { "NSLocationWhenInUseUsageDescription": "…mesma frase…" } }
}
```

Só permissão *when in use*. Não há rastreamento em segundo plano: a posição é lida no instante do
toque e nada mais.

---

## 6. Mobile — localização e Nominatim

### 6.1 `src/localizacao/localizacao.ts`

```ts
export type ResultadoLocalizacao =
  | { tipo: 'ok'; latitude: number; longitude: number; precisaoM: number | null }
  | { tipo: 'permissao_negada' }
  | { tipo: 'servico_desligado' }
  | { tipo: 'indisponivel' };
```

Estados separados porque a ação do montador difere: permissão negada manda abrir os ajustes do app;
serviço desligado manda ligar o GPS; indisponível é "tente de novo". Captura com
`Accuracy.High` e timeout.

### 6.2 `src/localizacao/nominatim.ts`

`GET https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=..&lon=..&zoom=18&addressdetails=1&accept-language=pt-BR`

A [política de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/) é
obrigatória e o serviço bloqueia quem a ignora:

- **`User-Agent` identificando a aplicação** em toda requisição — constante
  `USER_AGENT_NOMINATIM = 'MontaControl/1.0 (+https://github.com/ICEI-PUC-Minas-PMGES-TI/pmg-es-2026-1-tcci-6583100-dev-montacontrol-3)'`.
  Identifica a aplicação pelo repositório, sem dado pessoal no header.
- **Máximo absoluto de 1 requisição por segundo.** Implementado como fila serial com intervalo
  mínimo de 1100 ms — não como `Promise.all`.
- Cache em memória por coordenada arredondada a 4 casas decimais (~11 m), evitando repetir a chamada
  enquanto o montador olha a tela.
- Timeout de 5 s. Falha devolve `null` e **nunca** bloqueia o check-in: o registro segue sem
  endereço e é resolvido depois.

O endereço exibido é montado de `address` (`road`, `house_number`, `suburb`, `city`, `state`), com
`display_name` como fallback.

### 6.3 Resolução tardia do endereço

Registro gravado offline fica com `endereco = null`. Quando a outbox é drenada com sucesso e há
rede, o mesmo passo tenta o reverse geocoding e envia o endereço junto. Se o registro já foi enviado
sem endereço, ele permanece sem — não há reenvio só para completar o campo.

---

## 7. Mobile — componente de mapa

`src/ui/MapaLocalizacao.tsx`, com contrato em `packages/ui-contracts/src/mapaLocalizacao.ts`:

```ts
export interface PropsMapaLocalizacao {
  latitude: number;
  longitude: number;
  /** Endereço já resolvido; `null` mostra "endereço indisponível". */
  endereco?: string | null;
  /** Padrão 16. */
  zoom?: number;
  /** Altura do mapa em px. Padrão 180. */
  altura?: number;
  /**
   * Padrão `false`. Um mapa que aceita arrasto dentro de uma tela rolável
   * captura o gesto e trava a rolagem — só liga quando o mapa ocupa a tela.
   */
  interativo?: boolean;
}
```

Implementação: `WebView` com HTML inline (`source={{ html }}`), Leaflet, tiles
`https://tile.openstreetmap.org/{z}/{x}/{y}.png`, marcador na coordenada e o controle de atribuição
`© OpenStreetMap contributors` — a atribuição é exigida pela licença e não pode ser removida. Com
`interativo: false`, `dragging`, `scrollWheelZoom`, `touchZoom` e `doubleClickZoom` ficam
desligados.

Abaixo do mapa, o componente renderiza as coordenadas formatadas (`-19.932500, -43.938200`, 6 casas)
e o endereço. Sem rede os tiles não carregam: o componente mostra um estado vazio com as coordenadas
e a mensagem de mapa indisponível, em vez de um retângulo cinza mudo.

O componente **não** captura GPS nem chama o Nominatim — recebe tudo por props. Isso o mantém
testável sem mocks nativos e reutilizável na tela de histórico depois.

---

## 8. Mobile — camada offline

```
src/dados/
├── banco.ts                 # instância do Database (adapter SQLite)
├── esquema.ts               # appSchema, versão 1
├── modelos/
│   ├── JornadaLocal.ts
│   └── ItemOutbox.ts
├── outbox.ts                # enfileirar / drenar
└── sincronizacao.ts         # synchronize() com pull HTTP
```

**Tabela `jornada`** (espelho, somente leitura local): `servidor_id`, `status`, `checkin_at`,
`checkin_latitude`, `checkin_longitude`, `checkin_endereco`, e os equivalentes de checkout.

**Tabela `outbox`** (local, nunca sincronizada pelo protocolo): `tipo`
(`TipoOperacaoOutbox.CHECKIN` / `CHECKOUT`), `payload_json`, `status` (`StatusOutbox`),
`tentativas`, `ultimo_erro`, `criado_em`.

A outbox **não participa** do protocolo do WatermelonDB: `pushChanges` ignora `changes.outbox`. O
estado dela é o campo `status` (`StatusOutbox`), nunca o `_status` interno do WatermelonDB.

**Check-in otimista:** o toque grava imediatamente uma linha local de jornada e um item de outbox,
dentro da mesma transação — a tela reflete o check-in na hora, com ou sem rede. Quando a drenagem
confirma, a linha local recebe o `servidor_id` e o pull passa a ser a fonte da verdade daquela
jornada.

**Drenagem:** dispara ao abrir o app, ao voltar do background, quando o NetInfo indica rede, e após
cada nova operação. Serial, na ordem de criação (um check-out não pode ser enviado antes do
check-in que o precede). Resultado por item:

- `2xx` → `ENVIADO`, linha local reconciliada.
- `4xx` → `DESCARTADO` com `ultimo_erro` = `codigo` do corpo padrão; a tela mostra um `Alerta`.
- rede / `5xx` → segue `PENDENTE`, `tentativas++`, retentado depois com backoff.

---

## 9. Mobile — telas

```
src/telas/Jornada.tsx                    # casca da aba: alterna checkin ↔ historico
src/telas/jornada/TelaCheckin.tsx
src/telas/jornada/TelaHistoricoPontos.tsx
src/telas/jornada/CartaoDia.tsx
src/telas/jornada/SeletorPeriodo.tsx
src/jornada/useJornadaAtual.ts
src/jornada/useHistoricoPontos.ts
src/jornada/acoes.ts
```

Sem aba nova e sem React Navigation. `Jornada.tsx` mantém `useState<'checkin' | 'historico'>`; o
histórico é uma tela filha, alcançada só pela tela de check-in.

**`TelaCheckin`** (vista padrão da aba):

- Saudação com nome do montador (já existente).
- Cartão de estado: "Nenhuma jornada em andamento" ou "Em andamento desde HH:mm" com badge.
- `MapaLocalizacao` com a posição capturada (ou a do check-in em andamento, vinda do banco local).
- Coordenadas e endereço em exibição.
- Botão principal: **Fazer check-in** / **Fazer check-out**, com estado de carregando durante a
  captura de GPS.
- Alerta quando permissão é negada, GPS desligado ou item da outbox foi `DESCARTADO`.
- Entrada secundária **"Histórico de pontos"** → `setVista('historico')`.
- Botão **Sair** (já existente).

**`TelaHistoricoPontos`**:

- Cabeçalho com título e ação de voltar → `setVista('checkin')`.
- `BackHandler` interceptando o botão físico de voltar do Android enquanto a vista é `historico` —
  sem isso o Android fecha o app em vez de voltar ao check-in. A assinatura é registrada em
  `useEffect` e removida na saída.
- `SeletorPeriodo`: 5 / 15 / 30 dias, padrão 15.
- Total do período no topo (`totalMinutos` formatado como `Xh YYmin`).
- Lista de `CartaoDia`, do mais recente ao mais antigo.
- Estado vazio: "Nenhum ponto registrado neste período."

**`CartaoDia`**: data por extenso curta (`ter, 26 ago`), hora de início, hora de fim (ou `—` com
badge "em andamento" / "sem check-out"), total do dia. Usa `Cartao`, `Badge` e `Texto` já
existentes; nenhum valor de cor ou espaçamento hardcodado — tudo de
`@montacontrol/design-tokens/native`.

`useHistoricoPontos(periodo)` lê a tabela local, converte para `JornadaDTO` e aplica
`agruparJornadasPorDia` com o fuso de operação — a mesma função que o backend usa. A tela funciona
offline com o que o último pull trouxe.

---

## 10. Testes

**`packages/shared` (unitário puro, sem infraestrutura):** `agruparJornadasPorDia`

- Duas jornadas no mesmo dia → `inicio` é o menor check-in, `fim` o maior check-out, minutos somados.
- Jornada sem check-out → `emAndamento: true`, contribui 0 minuto.
- Jornada que cruza a meia-noite → conta inteira no dia do check-in.
- Check-in às 21h em `America/Sao_Paulo` (00h UTC do dia seguinte) → cai no dia local, não no dia
  UTC.

**Backend unitário (`Test.createTestingModule` + `overrideProvider(JornadasRepository)`):**

- Check-in cria jornada quando não há aberta.
- Check-in com `idCliente` repetido devolve a existente e **não** chama `criar`.
- Check-in com jornada `EM_ANDAMENTO` → `JornadaEmAndamentoException`.
- `registradoEm` 1 hora no futuro → `RegistroForaDaJanelaException`.
- Check-out finaliza, grava coordenadas e muda o status.
- Check-out sem jornada aberta → `SemJornadaAbertaException`.
- Check-out anterior ao check-in → `CheckoutAntesDoCheckinException`.

**Backend integração (Supertest):** rota crítica de autorização —

- Sem token → `401`.
- Token de perfil não-MONTADOR → `403`.
- `?dias=7` → `400`.
- Dois `POST /checkin` com o mesmo `idCliente` → mesma `id` de jornada nas duas respostas.
- Dois `POST /checkin` com `idCliente` diferentes → `409` no segundo.

Adicionar `./src/jornadas/**/*.ts` ao `coverageThreshold` do `apps/api/package.json`, no mesmo
patamar de `auth` e `usuarios` (85% branches / 90% lines).

**Mobile (`@testing-library/react-native`):**

- `CartaoDia` renderiza início, fim e total; dia em andamento mostra o badge e `—` no fim.
- `SeletorPeriodo` troca de período e chama o callback.
- `MapaLocalizacao` (WebView mockada) injeta as coordenadas certas no HTML e exibe o texto das
  coordenadas; sem endereço mostra "endereço indisponível".
- Fluxo de check-in com `expo-location` mockado: permissão negada mostra `Alerta` e **não** enfileira
  na outbox.
- Outbox: 4xx marca `DESCARTADO`; falha de rede mantém `PENDENTE` e incrementa `tentativas`.

Valem as duas pegadinhas já documentadas no README do mobile: `render`/`fireEvent` são assíncronos
(`await`), e nunca `jest.resetAllMocks()` no `beforeEach`.

---

## 11. Documentação a atualizar

- `Codigo/apps/mobile/README.md` — seção de execução (prebuild + dev client, fim do Expo Go), camada
  offline, política do Nominatim, e a estrutura da aba Jornada com a tela filha de histórico.
- `Codigo/README.md` — nova variável/etapa de build do mobile, se houver.
- `Artefatos/` — o DER muda (colunas novas em `jornada`), então o diagrama precisa ser regenerado.
  É a exceção prevista no `CLAUDE.md` para tocar em documentação num PR de código.

---

## 12. Riscos

| Risco | Mitigação |
| --- | --- |
| WatermelonDB pode não ter build compatível com Expo SDK 57 / RN 0.86 | Verificar logo no primeiro passo da implementação. Se não houver, cair para `expo-sqlite` mantendo as mesmas interfaces de `src/dados/` — as telas e a outbox não mudam |
| Perda do Expo Go quebra o fluxo de quem testa no aparelho | Documentar o dev build no README antes de mergear |
| Nominatim bloquear o app por excesso ou `User-Agent` ausente | Fila serial de 1 req/s e `User-Agent` obrigatório desde o primeiro commit; falha degrada para "sem endereço", nunca quebra o check-in |
| Tiles OSM não carregam offline | Estado vazio explícito com coordenadas, em vez de retângulo cinza |
| Relógio do aparelho errado gravando jornada em data arbitrária | Janela de aceitação de `registradoEm` (+5 min / −7 dias) validada no service |
