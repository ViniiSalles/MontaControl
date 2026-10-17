import { definirTokens } from '../../auth/tokenSessao';
import { ErroApi } from '../../jornada/clienteJornadas';
import { buscarBancoHoras } from '../clienteBancoHoras';

describe('clienteBancoHoras', () => {
  beforeEach(() => {
    definirTokens({ accessToken: 'token-abc', refreshToken: 'refresh-abc' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('busca o saldo do mês/ano com o token no cabeçalho e a URL correta', async () => {
    const fetchFalso = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 1, usuarioId: 7, mes: 8, ano: 2026, horasTrabalhadas: 160, horasPrevistas: 168, saldo: -8 }),
    });
    global.fetch = fetchFalso as unknown as typeof fetch;

    const bancoHoras = await buscarBancoHoras(8, 2026);

    expect(bancoHoras.saldo).toBe(-8);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/banco-horas\?mes=8&ano=2026$/);
    expect(opcoes.headers.Authorization).toBe('Bearer token-abc');
  });

  it('erro da API vira ErroApi com o código e o status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ codigo: 'ERRO_VALIDACAO', message: 'mes inválido' }),
    }) as unknown as typeof fetch;

    const erro = await buscarBancoHoras(13, 2026).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ codigo: 'ERRO_VALIDACAO', status: 400 });
  });
});
