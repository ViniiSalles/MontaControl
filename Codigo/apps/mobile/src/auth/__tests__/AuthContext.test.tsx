import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { ProvedorAuth, useAuth } from '../AuthContext';
import * as armazenamento from '../armazenamentoSessao';
import * as database from '../../db/database';
import { gestor, montador, respostaJson, sessaoDe } from './apoio';

jest.mock('../armazenamentoSessao');
// `AuthContext` chama `limparBancoLocal` do singleton real de
// `db/database.ts` em três caminhos (sair, restore com perfil não-MONTADOR,
// restore com refresh falho) — sem mock, `unsafeResetDatabase()` bateria no
// stub de `SQLiteAdapter` do `jest.setup.js` (que só existe para o import
// não quebrar) e derrubaria os testes que passam por esses caminhos. Mesmo
// padrão usado em `navegacao/__tests__/RootNavigator.test.tsx`.
jest.mock('../../db/database');

const armazenamentoMock = jest.mocked(armazenamento);
const databaseMock = jest.mocked(database);

/** Espelha para a árvore o que só o contexto sabe, para os testes afirmarem sobre texto. */
function Sonda() {
  const { sessao, restaurando, entrar, sair } = useAuth();
  return (
    <>
      <Text testID="restaurando">{String(restaurando)}</Text>
      <Text testID="usuario">{sessao?.usuario.nome ?? 'sem-sessao'}</Text>
      <Text testID="access">{sessao?.accessToken ?? '-'}</Text>
      <Pressable testID="entrar" onPress={() => void entrar(montador.email, 'senha-correta')}>
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
  databaseMock.limparBancoLocal.mockResolvedValue(undefined);
  globalThis.fetch = jest.fn();
});

describe('restauração de sessão no boot', () => {
  test('sem tokens guardados termina o boot sem sessão', async () => {
    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('token válido restaura a sessão a partir de GET /auth/me', async () => {
    armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, montador));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);
    expect(armazenamentoMock.limparTokens).not.toHaveBeenCalled();
  });

  // TI02: JWT expirado devolve 401; o app renova em silêncio e só pede novo
  // login se o refresh também falhar.
  test('access token expirado renova pelo refresh token e persiste a sessão nova', async () => {
    armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'velho', refreshToken: 'refresh' });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' }))
      .mockResolvedValueOnce(respostaJson(200, sessaoDe(montador, '-novo')));

    await renderizarComSonda();

    expect(screen.getByTestId('access')).toHaveTextContent('access-novo');
    expect(armazenamentoMock.salvarTokens).toHaveBeenCalledWith({
      accessToken: 'access-novo',
      refreshToken: 'refresh-novo',
    });
  });

  test('refresh recusado limpa os tokens e volta ao Login', async () => {
    armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'velho', refreshToken: 'expirado' });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' }))
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' }));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.limparTokens).toHaveBeenCalled();
    // Refresh falhou e a sessão local acabou — sem limpar o espelho aqui, o
    // próximo montador a logar neste aparelho veria a jornada do anterior.
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
  });

  test('falha de rede preserva os tokens para a próxima abertura', async () => {
    armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    jest.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Network request failed'));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.limparTokens).not.toHaveBeenCalled();
    // Falha de rede mantém a sessão local para a próxima abertura — não é
    // fim de sessão, então o espelho não deve ser tocado.
    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
  });

  test('perfil não-MONTADOR guardado no aparelho é descartado', async () => {
    armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, gestor));

    await renderizarComSonda();

    expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao');
    expect(armazenamentoMock.limparTokens).toHaveBeenCalled();
    // Idem: perfil recusado também encerra a sessão local guardada no
    // aparelho, e precisa limpar o espelho pelo mesmo motivo.
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
  });
});

describe('sair()', () => {
  test('limpa tokens e o espelho local do banco, e encerra a sessão no servidor', async () => {
    armazenamentoMock.lerTokens.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(200, montador)) // restaurar: GET /auth/me
      .mockResolvedValueOnce(respostaJson(204, null)); // encerrarSessaoNoServidor: POST /auth/sair

    await renderizarComSonda();
    expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome);

    await fireEvent.press(screen.getByTestId('sair'));

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    expect(armazenamentoMock.limparTokens).toHaveBeenCalled();
    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
  });
});
