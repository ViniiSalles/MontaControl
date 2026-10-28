import { definirTokens, geracaoDaSessao } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { pullSemMudancas } from '../../db/__tests__/apoio';
import { puxarMudancas } from '../pullChanges';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
});

describe('puxarMudancas', () => {
  it('pull comum devolve a resposta do servidor', async () => {
    const resposta = pullSemMudancas(1_700_000_000_000);
    fetchMock.mockResolvedValue(respostaJson(200, resposta));

    await expect(puxarMudancas(null, geracaoDaSessao())).resolves.toEqual(resposta);
  });

  it('com migration presente faz pull completo (lastPulledAt nulo) em vez de lançar', async () => {
    const resposta = pullSemMudancas(1_700_000_000_000);
    fetchMock.mockResolvedValue(respostaJson(200, resposta));
    const migracao = { from: 3, tables: ['x'], columns: [] };

    await expect(puxarMudancas(1_700_000_000_000, geracaoDaSessao(), migracao)).resolves.toEqual(resposta);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has('lastPulledAt')).toBe(false);
  });

  it('sem migration mantém o incremental', async () => {
    fetchMock.mockResolvedValue(respostaJson(200, pullSemMudancas(1_700_000_000_000)));

    await puxarMudancas(1_700_000_000_000, geracaoDaSessao(), null);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('lastPulledAt')).toBe('1700000000000');
  });
});
