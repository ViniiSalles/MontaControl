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

**O que é persistido são só os tokens** (`armazenamentoSessao.ts`, chave versionada `mc.sessao.v1`).
O `usuario` não: é sempre recarregado de `GET /api/auth/me` no boot, então nome, perfil e `ativo`
nunca ficam defasados — um montador desativado perde o acesso na próxima abertura do app, e não só
quando o token expira.

No boot, um `401` (TI02) gasta o refresh token uma vez; se o refresh também falhar, os tokens são
apagados e o app volta ao Login. Falha de **rede** não apaga nada: os tokens ficam para a próxima
abertura.

## URL da API

`src/config/api.ts` lê `expo.extra.apiUrl` do `app.json`. Sem isso, cai no padrão de emulador:
`http://10.0.2.2:3000` no Android (a AVD roda em outra interface de rede, então `localhost` ali é o
próprio emulador) e `http://localhost:3000` no iOS.

**Em aparelho físico o padrão não serve** — nem `localhost` nem `10.0.2.2` alcançam a máquina do
desenvolvedor. Aponte `expo.extra.apiUrl` para o IP dela na rede local (`http://192.168.x.y:3000`).

## Abas

`src/navegacao/abas.ts` declara as 5 abas do design desde já; só `jornada` tem `disponivel: true`.
As outras aparecem desabilitadas para que a barra inferior tenha a forma final agora, em vez de
mudar de layout a cada sprint. Cada sprint seguinte vira uma para `true` e acrescenta uma linha em
`telaPorAba` (`AppAutenticado.tsx`).

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
