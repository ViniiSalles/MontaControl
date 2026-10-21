# `@montacontrol/mobile`

App mobile (Expo + React Native + TypeScript), **exclusivo do perfil MONTADOR**. Consome
`@montacontrol/design-tokens` (tema para `StyleSheet`) e `@montacontrol/ui-contracts` (contratos de
props), e fala com a API NestJS por HTTP.

## Boot e splash de inicialização

O app **não tem onboarding** — sem carrossel, sem tela de apresentação, sem flag persistida. Abre
direto no Login e, autenticado, na aba padrão do perfil.

A **splash de inicialização** é outra coisa e existe: é a tela nativa de boot, segurada por
`SplashScreen.preventAutoHideAsync()` em `App.tsx` e liberada só quando o app sabe o que renderizar.
São duas condições, e as duas importam:

1. **As 5 faces da Inter carregadas.** O Android ignora `fontWeight` em fonte customizada, então
   texto pintado antes disso sai com o peso errado — não apenas sem estilo.
2. **A restauração da sessão concluída.** Sem esperar, o montador que já tem sessão veria o Login
   piscar antes de cair na Jornada.

Enquanto isso `PortaoDeBoot` renderiza `null`: a splash nativa cobre a tela, não há nada a desenhar
por baixo dela.

## Sessão e roteamento

```
App.tsx
└── ProvedorAuth                    (restaura a sessão do Keychain/Keystore)
    └── PortaoDeBoot                (segura a splash nativa)
        └── RootNavigator           sessao ? AppAutenticado : Login
            └── AppAutenticado      aba ativa + BarraNavInferior
                └── Jornada         ABA_PADRAO
```

`RootNavigator` deriva a tela da sessão **no render** — não há navegação imperativa nem histórico.
Autenticar troca a árvore; `sair()` (ou uma sessão expirada que não renovou) traz de volta ao Login.
Não usamos React Navigation: com uma aba navegável na Sprint 1, ela custaria quatro dependências
nativas e um prebuild novo empilhados sobre o do WatermelonDB.

**Só MONTADOR entra.** GESTOR, RH e DEPOSITO são recusados em `AuthContext.entrar` mesmo com
credencial correta, e o token **nunca** é persistido nesse caso. O espelho disso está em
`apps/web/src/auth/AuthContext.tsx`, que recusa o MONTADOR.

**O que é persistido** (`src/auth/armazenamentoSessao.ts`, chave versionada `mc.sessao.v2` no
SecureStore) são os tokens **e** o `UsuarioDTO` do login (id, nome, e-mail, perfil, ativo). Com isso
o app abre direto na Jornada mesmo sem rede, usando o usuário em cache; só depois de entrar ele
revalida `GET /api/auth/me` em segundo plano (`src/auth/AuthContext.tsx`). Se o servidor responder
que o perfil deixou de ser MONTADOR, a sessão local é encerrada; um montador desativado perde o
acesso na primeira abertura com conexão, não só quando o token expira. Falha de **rede** na
revalidação não apaga nada.

Um `401` na revalidação (ou em qualquer chamada autenticada) gasta o refresh token uma vez. Se o
refresh for **recusado**, a sessão é encerrada à força: os tokens e a réplica local são apagados,
mas a fila de ações pendentes (marcações de ponto ainda não enviadas) **é mantida**, com um marcador
do dono (`mc.fila.dono.v1` no SecureStore e a chave `dono_da_fila` no banco local). No login
seguinte, se quem autentica não for comprovadamente o mesmo dono, a fila e o resto do estado local
são apagados antes de o token ser liberado — uma ação de um montador nunca sai sob o token de outro.
O **logout explícito** apaga tudo: sessão, banco local, fila e marcador de dono.

A decisão de arquitetura completa está em
`Documentacao/offline-first/DECISAO-ARQUITETURA-OFFLINE-FIRST.md`.

## URL da API

`src/config/api.ts` resolve a base da API nesta ordem:

1. `EXPO_PUBLIC_API_URL` (`.env.local`) — override explícito;
2. `expo.extra.apiUrl` do `app.json`;
3. **IP do servidor de desenvolvimento do Expo**, detectado sozinho (`Constants.expoConfig.hostUri`)
   com a porta `3000` — funciona em aparelho físico e emulador, e acompanha mudanças de IP a cada
   `expo start`. Em modo túnel (`--tunnel`) o host não é um IP e esse passo é ignorado;
4. padrão de emulador: `http://10.0.2.2:3000` no Android e `http://localhost:3000` no iOS.

Na prática, em dev não é preciso configurar nada: deixe `EXPO_PUBLIC_API_URL` comentada. A API e o
Expo precisam rodar na mesma máquina. Após mudar de rede, reinicie o `expo start` para o IP novo
valer.

## Abas

`src/navegacao/abas.ts` declara as 5 abas do design desde já; só `jornada` tem `disponivel: true`.
As outras aparecem desabilitadas para que a barra inferior tenha a forma final agora, em vez de
mudar de layout a cada sprint. Cada sprint seguinte vira uma para `true` e acrescenta uma linha em
`telaPorAba` (`AppAutenticado.tsx`).

## Bipagem (US02)

A aba **Bipagem** (`src/telas/Bipagem.tsx`) lê o código de barras de cada peça no descarregamento com
`expo-camera` (ou digitação manual) e confere contra o **pedido ativo** inteiramente na réplica local
(`src/conferencia/conferencia.ts`) — funciona sem sinal (N4T3). Peça de outro pedido ou código
desconhecido gera alerta de inconsistência (N4T2). Cada leitura entra na fila (`tipo: 'conferencia'`)
e sobe para `POST /api/pecas/conferencias`, que marca a peça `DESCARREGADA` ou `INCONSISTENTE`.

`expo-camera` é módulo nativo: depois de instalar, gere o dev client de novo
(`pnpm android` / `npx expo prebuild`) — o binário antigo não tem a câmera.

## Testes

`jest-expo` + `@testing-library/react-native` v14. Duas pegadinhas da v14 que já custaram caro aqui:

- **`render` e `fireEvent` são assíncronos** — sem `await`, o `setState` do campo ainda não foi
  aplicado quando o próximo evento dispara, e um botão que só habilita com o formulário preenchido
  continua desabilitado no momento do press.
- **Nunca usar `jest.resetAllMocks()`** num `beforeEach`: ele apaga também as implementações dos
  mocks que o preset `jest-expo` instala para os componentes nativos, e a primeira renderização da
  suíte quebra com `Element type is invalid`. Use `jest.clearAllMocks()`, que zera o histórico de
  chamadas e preserva as implementações.

`testMatch` está restrito a `**/*.test.ts?(x)` para que arquivos de apoio dentro de `__tests__/`
(fixtures, helpers) não sejam coletados como suíte vazia.

## Scripts

- `pnpm start` / `pnpm android` / `pnpm ios` — Expo dev server.
- `pnpm test` — Jest.
- `pnpm lint` — `eslint` com a config raiz do monorepo.

Para gerar um `.apk` instalável (release local, sem EAS), ver [`BUILD-APK.md`](./BUILD-APK.md).
