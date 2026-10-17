import { definirTokens } from '../../auth/tokenSessao';
import { ErroApi, buscarHistorico, buscarJornadaAtual, enviarCheckin } from '../clienteJornadas';

const PEDIDO = {
  idCliente: '11111111-1111-4111-8111-111111111111',
  latitude: -19.9325,
  longitude: -43.9382,
  registradoEm: '2026-08-26T16:00:00.000Z',
  pedidoId: 10,
};

describe('clienteJornadas', () => {
  beforeEach(() => {
    definirTokens({ accessToken: 'token-abc', refreshToken: 'refresh-abc' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('envia o token no cabeçalho e devolve a jornada', async () => {
    const fetchFalso = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 1 }),
    });
    global.fetch = fetchFalso as unknown as typeof fetch;

    const jornada = await enviarCheckin(PEDIDO);

    expect(jornada.id).toBe(1);
    const [, opcoes] = fetchFalso.mock.calls[0];
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  it('erro 4xx vira ErroApi com o código do corpo padrão e o status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ codigo: 'JORNADA_EM_ANDAMENTO', message: 'Já existe uma jornada.' }),
    }) as unknown as typeof fetch;

    await expect(enviarCheckin(PEDIDO)).rejects.toMatchObject({
      codigo: 'JORNADA_EM_ANDAMENTO',
      status: 409,
    });
  });

  it('corpo de erro ilegível ainda produz um ErroApi com o status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('não é JSON');
      },
    }) as unknown as typeof fetch;

    const erro = await enviarCheckin(PEDIDO).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(500);
  });

  it('busca a jornada atual com o token no cabeçalho e a URL correta', async () => {
    const fetchFalso = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 7 }),
    });
    global.fetch = fetchFalso as unknown as typeof fetch;

    const jornada = await buscarJornadaAtual();

    expect(jornada).toEqual({ id: 7 });
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/jornadas\/atual$/);
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  // O Nest responde 200 com corpo VAZIO quando o handler devolve `null` — o
  // caso normal de quem ainda não bateu o ponto do dia. `resposta.json()`
  // estouraria aqui, e a tela leria "sem jornada" como falha de rede.
  it('corpo vazio (sem jornada aberta) vira null, não erro', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    }) as unknown as typeof fetch;

    await expect(buscarJornadaAtual()).resolves.toBeNull();
  });

  it('buscarJornadaAtual: erro da API vira ErroApi com o código do corpo preservado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ codigo: 'PERFIL_NAO_PERMITIDO', message: 'Perfil sem acesso.' }),
    }) as unknown as typeof fetch;

    await expect(buscarJornadaAtual()).rejects.toMatchObject({
      codigo: 'PERFIL_NAO_PERMITIDO',
      status: 403,
    });
  });

  it('busca o histórico com o token no cabeçalho e a URL com o período', async () => {
    const fetchFalso = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ periodoDias: 15, inicioPeriodo: 'x', fimPeriodo: 'y', dias: [], totalMinutos: 0 }),
    });
    global.fetch = fetchFalso as unknown as typeof fetch;

    const historico = await buscarHistorico(15);

    expect(historico.periodoDias).toBe(15);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/jornadas\/historico\?dias=15$/);
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  it('buscarHistorico: erro da API vira ErroApi com o código do corpo preservado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ codigo: 'ERRO_INTERNO', message: 'Falha ao montar o histórico.' }),
    }) as unknown as typeof fetch;

    await expect(buscarHistorico(30)).rejects.toMatchObject({
      codigo: 'ERRO_INTERNO',
      status: 500,
    });
  });
});
