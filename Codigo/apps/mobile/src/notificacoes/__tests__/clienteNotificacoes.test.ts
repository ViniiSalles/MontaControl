import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { ErroApi } from '../../http/erroApi';
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '../clienteNotificacoes';

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token-abc', refreshToken: 'refresh-abc' });
});

describe('clienteNotificacoes', () => {
  test('marcarNotificacaoLida faz PATCH em /api/notificacoes/:id/lida com o token da sessão', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(marcarNotificacaoLida(61)).resolves.toBeUndefined();

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/notificacoes\/61\/lida$/);
    expect(opcoes.method).toBe('PATCH');
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
    expect(opcoes.body).toBeUndefined();
  });

  test('marcarTodasNotificacoesLidas faz POST em /api/notificacoes/marcar-todas-lidas', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(marcarTodasNotificacoesLidas()).resolves.toBeUndefined();

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/notificacoes\/marcar-todas-lidas$/);
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  test('resposta de erro do servidor rejeita com ErroApi', async () => {
    fetchMock.mockResolvedValueOnce(respostaJson(404, { message: 'Notificação não encontrada' }));

    await expect(marcarNotificacaoLida(999)).rejects.toBeInstanceOf(ErroApi);
  });
});
