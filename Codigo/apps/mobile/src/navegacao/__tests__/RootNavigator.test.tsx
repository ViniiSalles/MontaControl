import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { ProvedorAuth } from '../../auth/AuthContext';
import { RootNavigator } from '../RootNavigator';
import * as armazenamento from '../../auth/armazenamentoSessao';
import { definirTokens } from '../../auth/tokenSessao';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { gestor, montador, respostaJson, sessaoDe } from '../../auth/__tests__/apoio';
import { instalarGatilhosFalsos } from '../../sincronizacao/__tests__/gatilhosFalsos';

jest.mock('../../auth/armazenamentoSessao');
// `AuthContext#sair` chama `limparBancoLocal` no singleton real de
// `db/database.ts` — que aqui não é o banco de teste usado no
// `<DatabaseProvider>` da árvore (esse vem de `criarBancoDeTeste()`, via
// `arvore()` abaixo). Sem mock, `unsafeResetDatabase()` bateria no stub de
// `SQLiteAdapter` do `jest.setup.js` (que só existe para o import não
// quebrar) e derrubaria o teste de logout.
jest.mock('../../db/database', () => ({ limparBancoLocal: jest.fn().mockResolvedValue(undefined) }));

const armazenamentoMock = jest.mocked(armazenamento);

const SESSAO_SALVA = { accessToken: 'access', refreshToken: 'refresh', usuario: montador };

const PLACEHOLDER_EMAIL = 'nome@empresa.com.br';
const PLACEHOLDER_SENHA = '••••••••';

// A aba Jornada (destino padrão pós-login) lê o espelho local por baixo dos
// panos — precisa de um `<DatabaseProvider>` mesmo aqui, que só testa
// navegação/autenticação, não dado de jornada em si.
let database = criarBancoDeTeste();

function arvore() {
  return (
    <DatabaseProvider database={database}>
      <ProvedorAuth>
        <RootNavigator />
      </ProvedorAuth>
    </DatabaseProvider>
  );
}

async function renderizarApp() {
  await render(arvore());
  // Espera o boot decidir; sem isso o teste afirmaria sobre a árvore ainda
  // em restauração.
  await waitFor(() => expect(screen.getByText('Entrar')).toBeTruthy());
}

/**
 * `fireEvent` e assincrono no @testing-library/react-native v14, como
 * `render` (ver Task 4). Sem o `await`, o `setState` do campo ainda nao foi
 * aplicado quando o proximo evento dispara — e o botao, que so habilita com
 * e-mail e senha preenchidos, continuaria desabilitado no momento do press.
 */
async function preencherEEnviar(email: string, senha: string) {
  await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER_EMAIL), email);
  await fireEvent.changeText(screen.getByPlaceholderText(PLACEHOLDER_SENHA), senha);
  await fireEvent.press(screen.getByText('Entrar'));
}

beforeEach(() => {
  // `resetAllMocks` apagaria tambem as implementacoes dos mocks que o
  // preset jest-expo instala para os componentes nativos do RN, e a
  // primeira renderizacao da suite quebraria com "Element type is
  // invalid". `clearAllMocks` zera o historico de chamadas e preserva as
  // implementacoes, que e o que estes testes precisam.
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  definirTokens(null);
  armazenamentoMock.lerSessao.mockResolvedValue(null);
  armazenamentoMock.salvarSessao.mockResolvedValue(undefined);
  armazenamentoMock.limparSessao.mockResolvedValue(undefined);
  // Default rejeitando: a aba Jornada busca `GET /api/jornadas/atual` assim
  // que monta, e um `jest.fn()` cru devolveria `undefined` para esse `await`.
  // Cada teste ainda enfileira suas respostas com `mockResolvedValueOnce`.
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
});

test('sem sessão o app abre no Login, não no onboarding', async () => {
  await renderizarApp();

  expect(screen.getByText('MontaControl')).toBeTruthy();
  expect(screen.getByText('Entrar')).toBeTruthy();
});

// N1T1 / TI01: credenciais válidas de MONTADOR autenticam e caem na aba
// padrão (Jornada), com o token persistido.
test('N1T1/TI01 — MONTADOR válido vai para a aba Jornada e o token é guardado', async () => {
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));

  await renderizarApp();
  await preencherEEnviar(montador.email, 'senha-correta');

  await waitFor(() => expect(screen.getByText('Jornada de Trabalho')).toBeTruthy());
  expect(screen.getByText('Jornada')).toBeTruthy();
  expect(armazenamentoMock.salvarSessao).toHaveBeenCalledWith({
    accessToken: 'access',
    refreshToken: 'refresh',
    usuario: montador,
  });
});

// N1T2: a API devolve 401 genérico; a tela mostra a mensagem sem revelar
// qual etapa falhou, e o acesso é negado.
test('N1T2 — senha incorreta mostra credenciais inválidas e não autentica', async () => {
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(
      respostaJson(401, { codigo: 'CREDENCIAIS_INVALIDAS', message: 'Credenciais inválidas' }),
    );

  await renderizarApp();
  await preencherEEnviar(montador.email, 'senha-errada');

  await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeTruthy());
  expect(screen.queryByText('Jornada')).toBeNull();
  expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
});

// Plano, "Destinos de N1T1": perfis administrativos são recusados no mobile
// e o token não é persistido, mesmo com a credencial correta.
test('GESTOR com credencial válida é recusado e o token não é persistido', async () => {
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(gestor)));

  await renderizarApp();
  await preencherEEnviar(gestor.email, 'senha-correta');

  await waitFor(() =>
    expect(screen.getByText(/aplicativo é exclusivo do Montador/i)).toBeTruthy(),
  );
  expect(screen.queryByText('Jornada')).toBeNull();
  expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
});

test('falha de rede mostra mensagem de conexão em vez de credenciais inválidas', async () => {
  jest.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Network request failed'));

  await renderizarApp();
  await preencherEEnviar(montador.email, 'senha-correta');

  await waitFor(() => expect(screen.getByText(/Verifique sua conexão/i)).toBeTruthy());
});

test('sessão restaurada do aparelho abre direto na Jornada, sem passar pelo Login', async () => {
  armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, montador));

  await render(arvore());

  await waitFor(() => expect(screen.getByText('Jornada de Trabalho')).toBeTruthy());
  expect(screen.queryByText('Entrar')).toBeNull();
});

// #106: o montador que fechou o app numa obra sem sinal precisa conseguir bater ponto.
test('sessão guardada e aparelho sem rede abre direto na Jornada, sem passar pelo Login', async () => {
  armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
  jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Network request failed'));

  await render(arvore());

  await waitFor(() => expect(screen.getByText('Jornada de Trabalho')).toBeTruthy());
  expect(screen.queryByText('Entrar')).toBeNull();
  expect(armazenamentoMock.limparSessao).not.toHaveBeenCalled();
});

test('sair volta ao Login e limpa os tokens do aparelho', async () => {
  armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(respostaJson(200, montador))
    .mockResolvedValueOnce(respostaJson(204, null));

  await render(arvore());
  await waitFor(() => expect(screen.getByText('Jornada de Trabalho')).toBeTruthy());

  await fireEvent.press(screen.getByText('Sair'));

  await waitFor(() => expect(screen.getByText('Entrar')).toBeTruthy());
  expect(armazenamentoMock.limparSessao).toHaveBeenCalled();
});

// #107: a sincronização é do app autenticado; sair precisa desligar os gatilhos
// de rede e de primeiro plano, senão o app deslogado seguiria sincronizando.
test('sair remove os listeners de rede e de primeiro plano', async () => {
  const gatilhos = instalarGatilhosFalsos();
  armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(respostaJson(200, montador))
    .mockResolvedValueOnce(respostaJson(204, null));

  await render(arvore());
  await waitFor(() => expect(screen.getByText('Jornada de Trabalho')).toBeTruthy());
  expect(gatilhos.rede.size).toBe(1);
  expect(gatilhos.appState.size).toBe(1);

  await fireEvent.press(screen.getByText('Sair'));

  await waitFor(() => expect(screen.getByText('Entrar')).toBeTruthy());
  expect(gatilhos.rede.size).toBe(0);
  expect(gatilhos.appState.size).toBe(0);
});

test('a barra inferior traz as 5 abas, com Jornada, Avarias e Atestados habilitadas', async () => {
  armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, montador));

  await render(arvore());
  await waitFor(() => expect(screen.getByText('Jornada')).toBeTruthy());

  for (const rotulo of ['Jornada', 'Bipagem', 'Avarias', 'Atestados', 'Normas']) {
    expect(screen.getByText(rotulo)).toBeTruthy();
  }

  // Aba ainda não entregue não troca de tela.
  await fireEvent.press(screen.getByText('Bipagem'));
  expect(screen.getByText('Jornada de Trabalho')).toBeTruthy();
});
