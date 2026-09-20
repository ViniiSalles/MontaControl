import { ErroApi } from '../../jornada/clienteJornadas';
import { enviarAtestado, listarMeusAtestados } from '../clienteAtestados';

const DADOS = {
  idCliente: '11111111-1111-4111-8111-111111111111',
  dataInicio: '2026-09-01',
  dataFim: '2026-09-03',
  fotos: [{ conteudoBase64: 'abc123', mimeType: 'image/jpeg' as const }],
};

describe('clienteAtestados', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('envia o token no cabeçalho e devolve o atestado criado', async () => {
    const fetchFalso = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 5, status: 'PENDENTE' }),
    });
    global.fetch = fetchFalso as unknown as typeof fetch;

    const atestado = await enviarAtestado('token-abc', DADOS);

    expect(atestado).toEqual({ id: 5, status: 'PENDENTE' });
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/atestados$/);
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
    expect(JSON.parse(opcoes.body)).toEqual(DADOS);
  });

  it('erro 4xx no envio vira ErroApi com o código do corpo padrão e o status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ codigo: 'PERIODO_ATESTADO_INVALIDO', message: 'Período inválido.' }),
    }) as unknown as typeof fetch;

    await expect(enviarAtestado('token-abc', DADOS)).rejects.toMatchObject({
      codigo: 'PERIODO_ATESTADO_INVALIDO',
      status: 422,
    });
  });

  it('lista os próprios atestados com o token no cabeçalho', async () => {
    const fetchFalso = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, status: 'PENDENTE' }],
    });
    global.fetch = fetchFalso as unknown as typeof fetch;

    const atestados = await listarMeusAtestados('token-abc');

    expect(atestados).toEqual([{ id: 1, status: 'PENDENTE' }]);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/atestados\/meus$/);
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  it('erro ao listar vira ErroApi', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ codigo: 'ERRO_INTERNO', message: 'Falha ao listar.' }),
    }) as unknown as typeof fetch;

    const erro = await listarMeusAtestados('token-abc').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(500);
  });
});
