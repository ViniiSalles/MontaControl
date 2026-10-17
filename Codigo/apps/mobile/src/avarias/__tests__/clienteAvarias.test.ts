import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { enviarAvaria, listarMinhasAvarias, listarTiposAvaria } from '../clienteAvarias';

const fetchMock = jest.fn();

const REPORTE = {
  idCliente: '11111111-1111-4111-8111-111111111111',
  pecaId: 10,
  tipoAvariaId: 2,
  descricao: 'Porta arranhada',
  fotos: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token-abc', refreshToken: 'refresh-abc' });
});

describe('clienteAvarias', () => {
  test('enviarAvaria faz POST em /api/avarias com o token da sessão', async () => {
    fetchMock.mockResolvedValueOnce(respostaJson(201, { id: 5 }));

    await expect(enviarAvaria(REPORTE)).resolves.toEqual({ id: 5 });

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/avarias$/);
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
    expect(JSON.parse(opcoes.body)).toEqual(REPORTE);
  });

  test('listagens usam o token da sessão', async () => {
    fetchMock.mockResolvedValue(respostaJson(200, []));

    await listarMinhasAvarias();
    await listarTiposAvaria();

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/avarias\/minhas$/);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/avarias\/tipos$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-abc');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token-abc');
  });
});
