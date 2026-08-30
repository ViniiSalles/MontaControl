import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProvedorAuth } from '../../auth/AuthContext';
import { RootNavigator } from '../RootNavigator';
import * as armazenamento from '../../auth/armazenamentoSessao';
import { gestor, montador, respostaJson, sessaoDe } from '../../auth/__tests__/apoio';

jest.mock('../../auth/armazenamentoSessao');

const armazenamentoMock = jest.mocked(armazenamento);

const PLACEHOLDER_EMAIL = 'nome@empresa.com.br';
const PLACEHOLDER_SENHA = '••••••••';

async function renderizarApp() {
  await render(
    <ProvedorAuth>
      <RootNavigator />
    </ProvedorAuth>,
  );
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
  armazenamentoMock.lerTokens.mockResolvedValue(null);
  armazenamentoMock.salvarTokens.mockResolvedValue(undefined);
  armazenamentoMock.limparTokens.mockResolvedValue(undefined);
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

  await waitFor(() => expect(screen.getByText(montador.nome)).toBeTruthy());
  expect(screen.getByText('Jornada')).toBeTruthy();
  expect(armazenamentoMock.salvarTokens).toHaveBeenCalledWith({
    accessToken: 'access',
    refreshToken: 'refresh',
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
  expect(armazenamentoMock.salvarTokens).not.toHaveBeenCalled();
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
  expect(armazenamentoMock.salvarTokens).not.toHaveBeenCalled();
});

test('falha de rede mostra mensagem de conexão em vez de credenciais inválidas', async () => {
  jest.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Network request failed'));

  await renderizarApp();
  await preencherEEnviar(montador.email, 'senha-correta');

  await waitFor(() => expect(screen.getByText(/Verifique sua conexão/i)).toBeTruthy());
});

test('sessão restaurada do aparelho abre direto na Jornada, sem passar pelo Login', async () => {
  armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, montador));

  await render(
    <ProvedorAuth>
      <RootNavigator />
    </ProvedorAuth>,
  );

  await waitFor(() => expect(screen.getByText(montador.nome)).toBeTruthy());
  expect(screen.queryByText('Entrar')).toBeNull();
});

test('sair volta ao Login e limpa os tokens do aparelho', async () => {
  armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  jest
    .mocked(globalThis.fetch)
    .mockResolvedValueOnce(respostaJson(200, montador))
    .mockResolvedValueOnce(respostaJson(204, null));

  await render(
    <ProvedorAuth>
      <RootNavigator />
    </ProvedorAuth>,
  );
  await waitFor(() => expect(screen.getByText(montador.nome)).toBeTruthy());

  await fireEvent.press(screen.getByText('Sair'));

  await waitFor(() => expect(screen.getByText('Entrar')).toBeTruthy());
  expect(armazenamentoMock.limparTokens).toHaveBeenCalled();
});

test('a barra inferior traz as 5 abas com só a Jornada habilitada', async () => {
  armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
  jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, montador));

  await render(
    <ProvedorAuth>
      <RootNavigator />
    </ProvedorAuth>,
  );
  await waitFor(() => expect(screen.getByText('Jornada')).toBeTruthy());

  for (const rotulo of ['Jornada', 'Bipagem', 'Avarias', 'Atestados', 'Normas']) {
    expect(screen.getByText(rotulo)).toBeTruthy();
  }

  // Aba ainda não entregue não troca de tela.
  await fireEvent.press(screen.getByText('Bipagem'));
  expect(screen.getByText(montador.nome)).toBeTruthy();
});
