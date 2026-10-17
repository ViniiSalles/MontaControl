import { ErroSessaoExpirada, definirTokens } from '../../auth/tokenSessao';
import { montador, respostaJson, sessaoDe } from '../../auth/__tests__/apoio';
import { ErroApi } from '../erroApi';
import { requisitarAutenticado } from '../requisicao';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token-abc', refreshToken: 'refresh-abc' });
});

describe('requisitarAutenticado', () => {
  test('GET envia o token atual no cabeçalho Authorization e não manda corpo', async () => {
    fetchMock.mockResolvedValueOnce(respostaJson(200, { ok: true }));

    const resposta = await requisitarAutenticado('/api/algo?x=1');

    await expect(resposta.json()).resolves.toEqual({ ok: true });
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/algo\?x=1$/);
    expect(opcoes.method).toBe('GET');
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
    expect(opcoes.body).toBeUndefined();
  });

  test('POST serializa o corpo como JSON', async () => {
    fetchMock.mockResolvedValueOnce(respostaJson(201, {}));

    await requisitarAutenticado('/api/algo', { metodo: 'POST', corpo: { a: 1 } });

    const [, opcoes] = fetchMock.mock.calls[0];
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers['Content-Type']).toBe('application/json');
    expect(opcoes.body).toBe(JSON.stringify({ a: 1 }));
  });

  test('resposta de erro vira ErroApi com código, mensagem e status do corpo padrão', async () => {
    fetchMock.mockResolvedValueOnce(
      respostaJson(409, { codigo: 'JORNADA_ABERTA', message: 'Já existe jornada aberta.' }),
    );

    const erro = await requisitarAutenticado('/api/algo').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({
      codigo: 'JORNADA_ABERTA',
      message: 'Já existe jornada aberta.',
      status: 409,
    });
  });

  test('401 renova a sessão e repete a requisição uma vez com o token novo', async () => {
    fetchMock
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' }))
      .mockResolvedValueOnce(respostaJson(200, sessaoDe(montador, '-novo'))) // POST /auth/refresh
      .mockResolvedValueOnce(respostaJson(200, { ok: true }));

    const resposta = await requisitarAutenticado('/api/algo');

    await expect(resposta.json()).resolves.toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/refresh');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer access-novo');
  });

  test('sem sessão falha com ErroSessaoExpirada sem ir à rede', async () => {
    definirTokens(null);

    await expect(requisitarAutenticado('/api/algo')).rejects.toBeInstanceOf(ErroSessaoExpirada);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
