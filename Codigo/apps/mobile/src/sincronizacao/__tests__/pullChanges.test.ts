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

  it('migração de schema pedida pelo WatermelonDB falha alto, sem ir à rede (o contrato não a atende)', async () => {
    const migracao = { from: 3, tables: ['x'], columns: [] };

    await expect(puxarMudancas(1_700_000_000_000, geracaoDaSessao(), migracao)).rejects.toThrow(/migração/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
