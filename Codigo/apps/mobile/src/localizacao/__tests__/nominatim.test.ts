import { resolverEndereco } from '../nominatim';

const RESPOSTA_OK = {
  ok: true,
  json: async () => ({
    address: { road: 'Rua dos Aimorés', house_number: '1000', suburb: 'Funcionários', city: 'Belo Horizonte' },
    display_name: 'Rua dos Aimorés, 1000, Funcionários, Belo Horizonte, MG, Brasil',
  }),
};

describe('resolverEndereco', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('monta o endereço a partir dos campos estruturados', async () => {
    global.fetch = jest.fn().mockResolvedValue(RESPOSTA_OK) as unknown as typeof fetch;

    const promessa = resolverEndereco(-19.9325, -43.9382);
    await jest.runAllTimersAsync();

    await expect(promessa).resolves.toBe('Rua dos Aimorés, 1000 — Funcionários, Belo Horizonte');
  });

  it('envia o User-Agent exigido pela política do Nominatim', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(RESPOSTA_OK);
    global.fetch = fetchFalso as unknown as typeof fetch;

    const promessa = resolverEndereco(-19.94, -43.94);
    await jest.runAllTimersAsync();
    await promessa;

    const [, opcoes] = fetchFalso.mock.calls[0];
    expect(opcoes.headers['User-Agent']).toContain('MontaControl');
  });

  it('a mesma coordenada não gera segunda requisição (cache)', async () => {
    const fetchFalso = jest.fn().mockResolvedValue(RESPOSTA_OK);
    global.fetch = fetchFalso as unknown as typeof fetch;

    const primeira = resolverEndereco(-19.95, -43.95);
    await jest.runAllTimersAsync();
    await primeira;

    const segunda = resolverEndereco(-19.95, -43.95);
    await jest.runAllTimersAsync();
    await segunda;

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it('falha devolve null em vez de lançar — o check-in não pode depender disto', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const promessa = resolverEndereco(-19.96, -43.96);
    await jest.runAllTimersAsync();

    await expect(promessa).resolves.toBeNull();
  });
});
