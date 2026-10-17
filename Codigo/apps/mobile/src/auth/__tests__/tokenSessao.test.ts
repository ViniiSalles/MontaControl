import { ErroApi } from '../../http/erroApi';
import * as armazenamento from '../armazenamentoSessao';
import * as clienteAuth from '../clienteAuth';
import { ErroNaoAutorizado } from '../clienteAuth';
import {
  ErroSessaoExpirada,
  aoSessaoExpirar,
  atualizarUsuarioDaSessao,
  comTokenRenovado,
  definirTokens,
  obterTokenValido,
} from '../tokenSessao';
import { gestor, montador, sessaoDe } from './apoio';

jest.mock('../armazenamentoSessao');
jest.mock('../clienteAuth', () => ({
  ...jest.requireActual('../clienteAuth'),
  renovarSessao: jest.fn(),
}));

const armazenamentoMock = jest.mocked(armazenamento);
const renovarSessaoMock = jest.mocked(clienteAuth.renovarSessao);

const TOKENS = { accessToken: 'velho', refreshToken: 'refresh' };

function naoAutorizado(): ErroApi {
  return new ErroApi('TOKEN_EXPIRADO', 'expirado', 401);
}

beforeEach(() => {
  jest.clearAllMocks();
  armazenamentoMock.salvarSessao.mockResolvedValue(undefined);
  definirTokens(null);
});

describe('obterTokenValido', () => {
  test('devolve o access token da sessão em memória', async () => {
    definirTokens(TOKENS);

    await expect(obterTokenValido()).resolves.toBe('velho');
  });

  test('sem sessão falha com ErroSessaoExpirada, que não é ErroApi (a fila não descarta a ação)', async () => {
    const erro = await obterTokenValido().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroSessaoExpirada);
    expect(erro).not.toBeInstanceOf(ErroApi);
  });
});

describe('comTokenRenovado', () => {
  test('chamada que dá certo usa o token atual e não renova', async () => {
    definirTokens(TOKENS);
    const chamada = jest.fn().mockResolvedValue('ok');

    await expect(comTokenRenovado(chamada)).resolves.toBe('ok');

    expect(chamada).toHaveBeenCalledWith('velho');
    expect(renovarSessaoMock).not.toHaveBeenCalled();
  });

  test('401 renova pelo refresh token e repete a chamada uma vez com o token novo', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockResolvedValue(sessaoDe(montador, '-novo'));
    const chamada = jest.fn().mockRejectedValueOnce(naoAutorizado()).mockResolvedValueOnce('ok');

    await expect(comTokenRenovado(chamada)).resolves.toBe('ok');

    expect(renovarSessaoMock).toHaveBeenCalledWith('refresh');
    expect(chamada).toHaveBeenNthCalledWith(1, 'velho');
    expect(chamada).toHaveBeenNthCalledWith(2, 'access-novo');
    await expect(obterTokenValido()).resolves.toBe('access-novo');
  });

  test('persiste a sessão renovada (tokens novos e usuário) para sobreviver ao fechamento do app', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockResolvedValue(sessaoDe(montador, '-novo'));

    await comTokenRenovado(
      jest.fn().mockRejectedValueOnce(naoAutorizado()).mockResolvedValueOnce('ok'),
    );

    expect(armazenamentoMock.salvarSessao).toHaveBeenCalledWith({
      accessToken: 'access-novo',
      refreshToken: 'refresh-novo',
      usuario: montador,
    });
  });

  test('reconhece também o ErroNaoAutorizado de /auth/me como 401', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockResolvedValue(sessaoDe(montador, '-novo'));
    const chamada = jest
      .fn()
      .mockRejectedValueOnce(new ErroNaoAutorizado('Sessão expirada'))
      .mockResolvedValueOnce('ok');

    await expect(comTokenRenovado(chamada)).resolves.toBe('ok');
  });

  test('só repete uma vez: segundo 401 depois de renovar com sucesso propaga o erro', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockResolvedValue(sessaoDe(montador, '-novo'));
    const chamada = jest.fn().mockRejectedValue(naoAutorizado());

    await expect(comTokenRenovado(chamada)).rejects.toMatchObject({ status: 401 });

    expect(chamada).toHaveBeenCalledTimes(2);
    expect(renovarSessaoMock).toHaveBeenCalledTimes(1);
  });

  test('erros que não são 401 (409, rede) passam direto, sem renovar', async () => {
    definirTokens(TOKENS);
    const recusa = new ErroApi('CONFLITO', 'conflito', 409);
    const rede = new TypeError('Network request failed');

    await expect(comTokenRenovado(jest.fn().mockRejectedValue(recusa))).rejects.toBe(recusa);
    await expect(comTokenRenovado(jest.fn().mockRejectedValue(rede))).rejects.toBe(rede);

    expect(renovarSessaoMock).not.toHaveBeenCalled();
  });

  test('refresh recusado encerra a sessão: limpa a memória, avisa quem ouve e falha com ErroSessaoExpirada', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockRejectedValue(
      new ErroNaoAutorizado('Refresh token inválido ou expirado'),
    );
    const aoExpirar = jest.fn();
    aoSessaoExpirar(aoExpirar);

    await expect(
      comTokenRenovado(jest.fn().mockRejectedValue(naoAutorizado())),
    ).rejects.toBeInstanceOf(ErroSessaoExpirada);

    expect(aoExpirar).toHaveBeenCalledTimes(1);
    await expect(obterTokenValido()).rejects.toBeInstanceOf(ErroSessaoExpirada);
  });

  test('refresh que falha por rede não encerra a sessão e propaga a falha (a fila segue pendente)', async () => {
    definirTokens(TOKENS);
    const rede = new TypeError('Network request failed');
    renovarSessaoMock.mockRejectedValue(rede);
    const aoExpirar = jest.fn();
    aoSessaoExpirar(aoExpirar);

    await expect(comTokenRenovado(jest.fn().mockRejectedValue(naoAutorizado()))).rejects.toBe(rede);

    expect(aoExpirar).not.toHaveBeenCalled();
    await expect(obterTokenValido()).resolves.toBe('velho');
  });

  test('refresh devolvendo perfil não-MONTADOR encerra a sessão sem guardar os tokens', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockResolvedValue(sessaoDe(gestor, '-novo'));
    const aoExpirar = jest.fn();
    aoSessaoExpirar(aoExpirar);

    await expect(
      comTokenRenovado(jest.fn().mockRejectedValue(naoAutorizado())),
    ).rejects.toBeInstanceOf(ErroSessaoExpirada);

    expect(aoExpirar).toHaveBeenCalledTimes(1);
    expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
  });

  test('401s simultâneos compartilham uma única renovação (o refresh token é rotativo)', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockImplementation(
      () => new Promise((resolver) => setTimeout(() => resolver(sessaoDe(montador, '-novo')), 10)),
    );
    const fazerChamada = () =>
      jest.fn().mockImplementation(async (token: string) => {
        if (token === 'velho') throw naoAutorizado();
        return token;
      });

    const resultados = await Promise.all([
      comTokenRenovado(fazerChamada()),
      comTokenRenovado(fazerChamada()),
      comTokenRenovado(fazerChamada()),
    ]);

    expect(resultados).toEqual(['access-novo', 'access-novo', 'access-novo']);
    expect(renovarSessaoMock).toHaveBeenCalledTimes(1);
  });

  test('401 de um token que outra chamada já trocou repete com o token atual, sem renovar de novo', async () => {
    definirTokens({ accessToken: 'atual', refreshToken: 'refresh' });
    const emVoo = jest.fn().mockImplementation(async (token: string) => {
      if (token === 'atual') {
        // Outra chamada terminou de renovar enquanto esta estava no ar.
        definirTokens({ accessToken: 'mais-novo', refreshToken: 'refresh-2' });
        throw naoAutorizado();
      }
      return token;
    });

    await expect(comTokenRenovado(emVoo)).resolves.toBe('mais-novo');

    expect(renovarSessaoMock).not.toHaveBeenCalled();
  });
});

describe('aoSessaoExpirar', () => {
  test('a função devolvida cancela o aviso', async () => {
    definirTokens(TOKENS);
    renovarSessaoMock.mockRejectedValue(new ErroNaoAutorizado('inválido'));
    const aoExpirar = jest.fn();
    const cancelar = aoSessaoExpirar(aoExpirar);
    cancelar();

    await comTokenRenovado(jest.fn().mockRejectedValue(naoAutorizado())).catch(() => undefined);

    expect(aoExpirar).not.toHaveBeenCalled();
  });
});

describe('atualizarUsuarioDaSessao', () => {
  test('persiste o usuário revalidado junto dos tokens atuais', async () => {
    definirTokens(TOKENS);

    await atualizarUsuarioDaSessao({ ...montador, nome: 'Nome Novo' });

    expect(armazenamentoMock.salvarSessao).toHaveBeenCalledWith({
      ...TOKENS,
      usuario: { ...montador, nome: 'Nome Novo' },
    });
  });

  test('sem sessão em memória (ex.: logout durante a revalidação) não grava nada', async () => {
    await atualizarUsuarioDaSessao(montador);

    expect(armazenamentoMock.salvarSessao).not.toHaveBeenCalled();
  });
});
