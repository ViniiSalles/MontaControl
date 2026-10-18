import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ErroApi } from '../../http/erroApi';
import { ProvedorAuth, useAuth } from '../AuthContext';
import { TIMEOUT_REFRESH_MS, TIMEOUT_REVALIDACAO_MS } from '../clienteAuth';
import * as armazenamento from '../armazenamentoSessao';
import * as database from '../../db/database';
import { reiniciarSessaoStore } from '../../estado/sessaoStore';
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

type Dono = { tipo: 'ausente' } | { tipo: 'dono'; usuarioId: number } | { tipo: 'erro' };
const ausente: Dono = { tipo: 'ausente' };
const erro: Dono = { tipo: 'erro' };
const dono = (usuarioId: number): Dono => ({ tipo: 'dono', usuarioId });

/** Estado da fila no aparelho quando alguém autentica: nº de ações e as duas fontes de dono. */
function prepararFila({
  acoes,
  banco = ausente,
  marcador = ausente,
}: {
  acoes: number | 'erro';
  banco?: Dono;
  marcador?: Dono;
}) {
  if (acoes === 'erro') databaseMock.contarAcoesNaFilaLocal.mockRejectedValue(new Error('banco'));
  else databaseMock.contarAcoesNaFilaLocal.mockResolvedValue(acoes);
  databaseMock.lerDonoNoBancoLocal.mockResolvedValue(banco);
  armazenamentoMock.lerDonoDaFila.mockResolvedValue(marcador);
}

const OUTRO_ID = 101;

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
  // O store de sessão é global (como no app): sem isto o usuário de um teste vaza para o seguinte.
  reiniciarSessaoStore();
  armazenamentoMock.lerSessao.mockResolvedValue(null);
  armazenamentoMock.salvarSessao.mockResolvedValue(undefined);
  armazenamentoMock.limparSessao.mockResolvedValue(undefined);
  armazenamentoMock.lerDonoDaFila.mockResolvedValue({ tipo: 'ausente' });
  databaseMock.contarAcoesNaFilaLocal.mockResolvedValue(0);
  databaseMock.lerDonoNoBancoLocal.mockResolvedValue({ tipo: 'ausente' });
  databaseMock.registrarDonoNoBancoLocal.mockResolvedValue(true);
  armazenamentoMock.registrarDonoDaFila.mockResolvedValue(true);
  armazenamentoMock.limparDonoDaFila.mockResolvedValue(undefined);
  databaseMock.limparBancoLocal.mockResolvedValue(undefined);
  databaseMock.limparEspelhoBancoLocal.mockResolvedValue(undefined);
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
        await jest.advanceTimersByTimeAsync(TIMEOUT_REVALIDACAO_MS);
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

  test('com rede e refresh inválido volta ao Login, limpa a sessão e a réplica, e preserva a fila', async () => {
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
    // Refresh falhou e a sessão local acabou — sem limpar a réplica aqui, o
    // próximo montador a logar neste aparelho veria a jornada do anterior. A
    // fila de ações pendentes fica (marcações de ponto ainda não enviadas),
    // marcada com o dono para só subir sob o token dele.
    expect(databaseMock.limparEspelhoBancoLocal).toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(armazenamentoMock.registrarDonoDaFila).toHaveBeenCalledWith(montador.id);
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

  // Refresh em segundo plano pode levar mais que a revalidação do boot: com 5s
  // ele abortaria e o token nunca seria renovado em rede ruim.
  test('refresh lento (acima do timeout da revalidação, abaixo do do refresh) renova e não faz logout', async () => {
    jest.useFakeTimers();
    try {
      const refreshDemora = TIMEOUT_REVALIDACAO_MS + 5000;
      expect(refreshDemora).toBeLessThan(TIMEOUT_REFRESH_MS);
      armazenamentoMock.lerSessao.mockResolvedValue({ ...SESSAO_SALVA, accessToken: 'velho' });
      let chamadasMe = 0;
      jest.mocked(globalThis.fetch).mockImplementation((url, init) => {
        if (String(url).includes('/api/auth/me')) {
          chamadasMe += 1;
          return Promise.resolve(
            chamadasMe === 1
              ? respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' })
              : respostaJson(200, montador),
          );
        }
        return new Promise((resolver, rejeitar) => {
          init?.signal?.addEventListener('abort', () => rejeitar(new Error('Aborted')));
          setTimeout(() => resolver(respostaJson(200, sessaoDe(montador, '-novo'))), refreshDemora);
        });
      });

      await render(
        <ProvedorAuth>
          <Sonda />
        </ProvedorAuth>,
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(refreshDemora + 100);
      });

      expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
      await expect(obterTokenValido()).resolves.toBe('access-novo');
      expect(armazenamentoMock.limparSessao).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('boot com fila de outro usuário apaga tudo antes de liberar a sessão', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    prepararFila({ acoes: 2, banco: dono(OUTRO_ID) });
    jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Network request failed'));

    await renderizarComSonda();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
  });

  test('boot em que não dá para gravar o dono no banco não abre a sessão nem libera o token', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    databaseMock.registrarDonoNoBancoLocal.mockResolvedValue(false);
    jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Network request failed'));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    await expect(obterTokenValido()).rejects.toThrow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('boot com fila sem dono conhecido (anterior à atualização) apaga a fila: custo único', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    prepararFila({ acoes: 2 });
    jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Network request failed'));

    await renderizarComSonda();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
  });

  test('boot do mesmo usuário com dono no banco mantém a fila e regrava o dono', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    prepararFila({ acoes: 2, banco: dono(montador.id) });
    jest.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Network request failed'));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
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
  test('refresh recusado em qualquer chamada autenticada encerra a sessão, limpa a réplica e preserva a fila', async () => {
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
    expect(databaseMock.limparEspelhoBancoLocal).toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(armazenamentoMock.registrarDonoDaFila).toHaveBeenCalledWith(montador.id);
    // O dono é registrado antes de a sessão sumir: um app fechado no meio não deixa fila sem dono.
    const ordemDono = armazenamentoMock.registrarDonoDaFila.mock.invocationCallOrder[0];
    const ordemLimpeza = armazenamentoMock.limparSessao.mock.invocationCallOrder[0];
    expect(ordemDono).toBeLessThan(ordemLimpeza);
  });

  test('sem conseguir registrar o dono, não há como preservar a fila com segurança: apaga tudo', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    armazenamentoMock.registrarDonoDaFila.mockResolvedValue(false);
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(200, montador))
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' }));
    await renderizarComSonda();
    await esperarChamadasDeRede(1);

    await act(async () => {
      await comTokenRenovado(() =>
        Promise.reject(new ErroApi('TOKEN_EXPIRADO', 'expirado', 401)),
      ).catch(() => undefined);
    });

    await waitFor(() => expect(databaseMock.limparBancoLocal).toHaveBeenCalled());
    expect(databaseMock.limparEspelhoBancoLocal).not.toHaveBeenCalled();
  });

  // Corrida: o /auth/me do boot ainda está no ar quando o montador sai.
  test('resposta tardia de /auth/me de uma sessão que já acabou é ignorada', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    let responderMe!: (resposta: Response) => void;
    jest.mocked(globalThis.fetch).mockImplementation((url) => {
      if (String(url).includes('/api/auth/me')) {
        return new Promise<Response>((resolver) => {
          responderMe = resolver;
        });
      }
      return Promise.resolve(respostaJson(204, null));
    });
    await renderizarComSonda();
    await waitFor(() => expect(responderMe).toBeDefined());

    await fireEvent.press(screen.getByTestId('sair'));
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    const limpezasDoSair = databaseMock.limparBancoLocal.mock.calls.length;
    await act(async () => {
      // Perfil recusado: se a resposta fosse aplicada, limparia o banco de novo.
      responderMe(respostaJson(200, gestor));
      await Promise.resolve();
    });

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(limpezasDoSair);
    expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
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

  async function entrarComoMontador() {
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));
    await renderizarComSonda();
    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome));
  }

  // A réplica (jornadas, banco de horas, obras) de outro usuário não pode ficar
  // exposta a quem entra, mesmo com a fila vazia (o wipe do sair/expiração pode ter falhado).
  test('fila vazia e dono de OUTRO usuário: apaga tudo, depois grava o dono novo', async () => {
    prepararFila({ acoes: 0, banco: dono(OUTRO_ID), marcador: dono(OUTRO_ID) });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
    expect(armazenamentoMock.limparDonoDaFila).toHaveBeenCalled();
    const ordemLimpeza = databaseMock.limparBancoLocal.mock.invocationCallOrder[0];
    const ordemDono = databaseMock.registrarDonoNoBancoLocal.mock.invocationCallOrder[0];
    expect(ordemLimpeza).toBeLessThan(ordemDono);
  });

  test('fila vazia e dono ilegível: apaga tudo', async () => {
    prepararFila({ acoes: 0, banco: erro });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
  });

  test('fila vazia e nenhum dono registrado: nada é apagado, mas o dono passa a ser quem entrou', async () => {
    prepararFila({ acoes: 0 });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
  });

  test('fila vazia e mesmo dono: mantém e regrava o dono', async () => {
    prepararFila({ acoes: 0, banco: dono(montador.id), marcador: dono(montador.id) });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
    expect(armazenamentoMock.limparDonoDaFila).toHaveBeenCalled();
  });

  // Invariante: após qualquer autenticação bem-sucedida, o dono do banco é o usuário
  // autenticado. Sem isso, um dono velho (X) venceria o marcador de Y e a fila de Y
  // sairia com o token de X.
  test('não conseguir gravar o dono no banco é fatal: o login falha e nenhum token é liberado', async () => {
    databaseMock.registrarDonoNoBancoLocal.mockResolvedValue(false);
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));
    await renderizarComSonda();

    await fireEvent.press(screen.getByTestId('entrar'));

    await waitFor(() => expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalled());
    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
    await expect(obterTokenValido()).rejects.toThrow();
  });

  test('sem marcador, a fila vazia não toca no SecureStore', async () => {
    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(armazenamentoMock.limparDonoDaFila).not.toHaveBeenCalled();
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
  });

  test('mesmo usuário com o dono guardado ao lado da fila (sem marcador): mantém a fila', async () => {
    prepararFila({ acoes: 2, banco: dono(montador.id) });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(databaseMock.registrarDonoNoBancoLocal).toHaveBeenCalledWith(montador.id);
  });

  test('mesmo usuário dono pelo marcador do SecureStore: mantém a fila e remove o marcador', async () => {
    prepararFila({ acoes: 2, marcador: dono(montador.id) });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(armazenamentoMock.limparDonoDaFila).toHaveBeenCalled();
  });

  test('outro usuário: apaga tudo (fila inclusive) antes de liberar o token, depois grava o dono novo', async () => {
    prepararFila({ acoes: 2, banco: dono(OUTRO_ID), marcador: dono(OUTRO_ID) });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
    expect(armazenamentoMock.limparDonoDaFila).toHaveBeenCalled();
    const ordemLimpeza = databaseMock.limparBancoLocal.mock.invocationCallOrder[0];
    const ordemSessao = armazenamentoMock.salvarSessao.mock.invocationCallOrder[0];
    const ordemDono = databaseMock.registrarDonoNoBancoLocal.mock.invocationCallOrder[0];
    expect(ordemLimpeza).toBeLessThan(ordemSessao);
    expect(ordemLimpeza).toBeLessThan(ordemDono);
  });

  test('fila não vazia e nenhuma fonte com dono: dono desconhecido, apaga', async () => {
    prepararFila({ acoes: 2 });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['dono do banco ilegível', { banco: erro }],
    ['marcador do SecureStore ilegível', { marcador: erro }],
    [
      'dono do banco ilegível mesmo com marcador do mesmo usuário',
      { banco: erro, marcador: dono(montador.id) },
    ],
  ])('%s: fail-closed, apaga a fila', async (_nome, fontes) => {
    prepararFila({ acoes: 2, ...fontes });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
  });

  test('não conseguir contar a fila: trata como não vazia e, sem dono, apaga', async () => {
    prepararFila({ acoes: 'erro' });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
  });

  // O marcador do SecureStore que sobrou do wipe de outro usuário (limpeza falhou)
  // não pode fazer o próximo boot apagar a fila do próprio usuário.
  test('marcador velho de outro usuário não prevalece sobre o dono do banco (que é do mesmo usuário)', async () => {
    prepararFila({ acoes: 2, banco: dono(montador.id), marcador: dono(OUTRO_ID) });

    await entrarComoMontador();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(armazenamentoMock.limparDonoDaFila).toHaveBeenCalled();
  });

  test('se não conseguir apagar a fila de outro usuário, o login falha e nenhum token é liberado', async () => {
    prepararFila({ acoes: 2, banco: dono(OUTRO_ID) });
    databaseMock.limparBancoLocal.mockRejectedValue(new Error('banco indisponível'));
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));
    await renderizarComSonda();

    await fireEvent.press(screen.getByTestId('entrar'));

    await waitFor(() => expect(databaseMock.limparBancoLocal).toHaveBeenCalled());
    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
    expect(armazenamentoMock.limparDonoDaFila).not.toHaveBeenCalled();
    expect(databaseMock.registrarDonoNoBancoLocal).not.toHaveBeenCalled();
    await expect(obterTokenValido()).rejects.toThrow();
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
  test('se o banco não deixar apagar a fila, marca o dono para o próximo login de outro usuário limpar', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockResolvedValue(respostaJson(200, montador));
    databaseMock.limparBancoLocal.mockRejectedValue(new Error('banco indisponível'));
    await renderizarComSonda();
    await esperarChamadasDeRede(1);

    await fireEvent.press(screen.getByTestId('sair'));

    await waitFor(() =>
      expect(armazenamentoMock.registrarDonoDaFila).toHaveBeenCalledWith(montador.id),
    );
    expect(armazenamentoMock.limparDonoDaFila).not.toHaveBeenCalled();
  });

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
    // Logout explícito apaga tudo, fila e marcador de dono inclusive.
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
    expect(databaseMock.limparEspelhoBancoLocal).not.toHaveBeenCalled();
    expect(armazenamentoMock.limparDonoDaFila).toHaveBeenCalled();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[1];
    expect(String(url)).toContain('/api/auth/sair');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer access');
    await expect(obterTokenValido()).rejects.toThrow();
  });
});
