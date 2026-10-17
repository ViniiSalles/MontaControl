import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { ErroApi } from '../../http/erroApi';
import { listarMeusPedidos } from '../clientePedidos';

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token-abc', refreshToken: 'refresh-abc' });
});

describe('clientePedidos', () => {
  test('lista as obras do montador com o token da sessão', async () => {
    fetchMock.mockResolvedValueOnce(respostaJson(200, [{ id: 10 }]));

    await expect(listarMeusPedidos()).resolves.toEqual([{ id: 10 }]);

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/pedidos\/meus$/);
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  test('erro da API vira ErroApi com o status', async () => {
    fetchMock.mockResolvedValueOnce(
      respostaJson(403, { codigo: 'SEM_PERMISSAO', message: 'Negado' }),
    );

    await expect(listarMeusPedidos()).rejects.toBeInstanceOf(ErroApi);
  });
});
