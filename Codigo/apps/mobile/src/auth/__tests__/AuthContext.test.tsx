import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ErroApi } from '../../http/erroApi';
import { ProvedorAuth, useAuth } from '../AuthContext';
import { TIMEOUT_REDE_BOOT_MS } from '../clienteAuth';
import * as armazenamento from '../armazenamentoSessao';
import * as database from '../../db/database';
import { comTokenRenovado, definirTokens, obterTokenValido } from '../tokenSessao';
import { gestor, montador, respostaJson, sessaoDe } from './apoio';

jest.mock('../armazenamentoSessao');
// `AuthContext` chama `limparBancoLocal` do singleton real de
// `db/database.ts` em vários caminhos (sair, boot com perfil não-MONTADOR,
// refresh recusado) — sem mock, `unsafeResetDatabase()` bateria no stub de
// `SQLiteAdapter` do `jest.setup.js` (que só existe para o import não
// quebrar) e derrubaria os testes que passam por esses caminhos. Mesmo
// padrão usado em `navegacao/__tests__/RootNavigator.test.tsx`.
jest.mock('../../db/database');

const armazenamentoMock = jest.mocked(armazenamento);
const databaseMock = jest.mocked(database);

const SESSAO_SALVA = { accessToken: 'access', refreshToken: 'refresh', usuario: montador };

/** Espelha para a árvore o que só o contexto sabe, para os testes afirmarem sobre texto. */
function Sonda() {
  const { sessao, restaurando, entrar, sair } = useAuth();
  return (
    <>
      <Text testID="restaurando">{String(restaurando)}</Text>
      <Text testID="usuario">{sessao?.usuario.nome ?? 'sem-sessao'}</Text>
      <Pressable
        testID="entrar"
        onPress={() => void entrar(montador.email, 'senha-correta').catch(() => undefined)}
      >
        <Text>Entrar</Text>
      </Pressable>
      <Pressable testID="sair" onPress={() => void sair()}>
        <Text>Sair</Text>
      </Pressable>
    </>
  );
}

async function renderizarComSonda() {
  await render(
    <ProvedorAuth>
      <Sonda />
    </ProvedorAuth>,
  );
  // A restauração é assíncrona; esperar por ela evita afirmar sobre o
  // estado transitório de boot.
  await waitFor(() => expect(screen.getByTestId('restaurando')).toHaveTextContent('false'));
}

/** Espera a revalidação de segundo plano (`GET /auth/me` e, se preciso, `/auth/refresh`) consumir as respostas. */
async function esperarChamadasDeRede(quantidade: number) {
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(quantidade));
  // Deixa o `setState`/limpeza que vem depois da última resposta assentar.
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  // `resetAllMocks` apagaria tambem as implementacoes dos mocks que o
  // preset jest-expo instala para os componentes nativos do RN, e a
  // primeira renderizacao da suite quebraria com "Element type is
  // invalid". `clearAllMocks` zera o historico de chamadas e preserva as
  // implementacoes, que e o que estes testes precisam.
  jest.clearAllMocks();
  definirTokens(null);
  armazenamentoMock.lerSessao.mockResolvedValue(null);
  armazenamentoMock.salvarSessao.mockResolvedValue(undefined);
  armazenamentoMock.limparSessao.mockResolvedValue(undefined);
  databaseMock.limparBancoLocal.mockResolvedValue(undefined);
  globalThis.fetch = jest.fn();
});

describe('restauração de sessão no boot', () => {
  test('sem sessão guardada termina o boot sem sessão', async () => {
    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('com sessão guardada entra na hora com o usuário em cache, sem esperar a rede', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    // `/auth/me` fica no ar: se o boot esperasse por ele, `restaurando` nunca viraria false.
    jest.mocked(globalThis.fetch).mockReturnValue(new Promise(() => undefined));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
    await expect(obterTokenValido()).resolves.toBe('access');
  });

  test('sem rede, abre o app com a sessão guardada e não apaga nada', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Network request failed'));

    await renderizarComSonda();
    await esperarChamadasDeRede(1);

    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
    expect(armazenamentoMock.limparSessao).not.toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
  });

  test('API que não responde não prende o boot nem derruba a sessão: estoura o timeout e segue logado', async () => {
    jest.useFakeTimers();
    try {
      armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
      // Simula o `fetch` do RN contra um host inalcançável: nunca resolve,
      // só rejeita quando o `AbortSignal` dispara.
      jest.mocked(globalThis.fetch).mockImplementation(
        (_url, init) =>
          new Promise((_resolve, rejeitar) => {
            init?.signal?.addEventListener('abort', () => rejeitar(new Error('Aborted')));
          }),
      );

      await render(
        <ProvedorAuth>
          <Sonda />
        </ProvedorAuth>,
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId('restaurando')).toHaveTextContent('false');
      expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(TIMEOUT_REDE_BOOT_MS);
      });

      expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
      expect(armazenamentoMock.limparSessao).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('com rede, revalida em GET /auth/me e atualiza o usuário em cache (tela e SecureStore)', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    const atualizado = { ...montador, nome: 'Nome Atualizado' };
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, atualizado));

    await renderizarComSonda();

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('Nome Atualizado'));
    expect(armazenamentoMock.salvarSessao).toHaveBeenCalledWith({
      ...SESSAO_SALVA,
      usuario: atualizado,
    });
  });

  // TI02: JWT expirado devolve 401; o app renova em silêncio e só pede novo
  // login se o refresh também falhar.
  test('com rede e access token expirado renova em silêncio e persiste a sessão nova', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue({ ...SESSAO_SALVA, accessToken: 'velho' });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' })) // /auth/me
      .mockResolvedValueOnce(respostaJson(200, sessaoDe(montador, '-novo'))) // /auth/refresh
      .mockResolvedValueOnce(respostaJson(200, montador)); // /auth/me repetido

    await renderizarComSonda();
    await esperarChamadasDeRede(3);

    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
    await expect(obterTokenValido()).resolves.toBe('access-novo');
    expect(armazenamentoMock.salvarSessao).toHaveBeenCalledWith({
      accessToken: 'access-novo',
      refreshToken: 'refresh-novo',
      usuario: montador,
    });
    expect(armazenamentoMock.limparSessao).not.toHaveBeenCalled();
  });

  test('com rede e refresh inválido volta ao Login e limpa a sessão e o banco local', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue({
      ...SESSAO_SALVA,
      accessToken: 'velho',
      refreshToken: 'expirado',
    });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' }))
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' }));

    await renderizarComSonda();

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    expect(armazenamentoMock.limparSessao).toHaveBeenCalled();
    // Refresh falhou e a sessão local acabou — sem limpar o espelho aqui, o
    // próximo montador a logar neste aparelho veria a jornada do anterior.
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
    await expect(obterTokenValido()).rejects.toThrow();
  });

  test('refresh que falha no servidor (5xx) não derruba a sessão', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue({ ...SESSAO_SALVA, accessToken: 'velho' });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' }))
      .mockResolvedValueOnce(respostaJson(503, null));

    await renderizarComSonda();
    await esperarChamadasDeRede(2);

    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
    expect(armazenamentoMock.limparSessao).not.toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
  });

  test('perfil não-MONTADOR guardado no aparelho é descartado sem nem abrir o app', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue({ ...SESSAO_SALVA, usuario: gestor });

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.limparSessao).toHaveBeenCalled();
    // Idem: perfil recusado também encerra a sessão local guardada no
    // aparelho, e precisa limpar o espelho pelo mesmo motivo.
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('revalidação que revela perfil não-MONTADOR encerra a sessão', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, gestor));

    await renderizarComSonda();

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    expect(armazenamentoMock.limparSessao).toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
  });
});

describe('durante a sessão', () => {
  test('refresh recusado em qualquer chamada autenticada encerra a sessão e limpa o banco local', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(200, montador)) // revalidação do boot
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' })); // /auth/refresh
    await renderizarComSonda();
    await esperarChamadasDeRede(1);

    await act(async () => {
      await comTokenRenovado(() =>
        Promise.reject(new ErroApi('TOKEN_EXPIRADO', 'expirado', 401)),
      ).catch(() => undefined);
    });

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    expect(armazenamentoMock.limparSessao).toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
  });
});

describe('entrar()', () => {
  test('guarda tokens e usuário juntos e libera o token para os clientes HTTP', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));
    await renderizarComSonda();

    await fireEvent.press(screen.getByTestId('entrar'));

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome));
    expect(armazenamentoMock.salvarSessao).toHaveBeenCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
      usuario: montador,
    });
    await expect(obterTokenValido()).resolves.toBe('access');
  });

  test('perfil não-MONTADOR é recusado e nada é guardado', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(gestor)));
    await renderizarComSonda();

    await fireEvent.press(screen.getByTestId('entrar'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
  });
});

describe('sair()', () => {
  test('limpa a sessão e o espelho local do banco, e encerra a sessão no servidor com o token atual', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(200, montador)) // revalidação do boot: GET /auth/me
      .mockResolvedValueOnce(respostaJson(204, null)); // encerrarSessaoNoServidor: POST /auth/sair

    await renderizarComSonda();
    await esperarChamadasDeRede(1);
    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);

    await fireEvent.press(screen.getByTestId('sair'));

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    expect(armazenamentoMock.limparSessao).toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[1];
    expect(String(url)).toContain('/api/auth/sair');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access');
    await expect(obterTokenValido()).rejects.toThrow();
  });
});
