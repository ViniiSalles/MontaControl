import { GeocodificacaoGateway, montarTentativas } from './geocodificacao.gateway';

const endereco = { endereco: 'Rua dos Timbiras, Funcionários', cidade: 'Belo Horizonte', estado: 'MG' };

describe('montarTentativas', () => {
  it('vai da busca estruturada com CEP até o texto livre', () => {
    const tentativas = montarTentativas({ ...endereco, cep: '30140-060' });

    expect(tentativas).toHaveLength(3);
    expect(tentativas[0].get('postalcode')).toBe('30140-060');
    expect(tentativas[0].get('street')).toBe('Rua dos Timbiras, Funcionários');
    expect(tentativas[1].get('postalcode')).toBeNull();
    expect(tentativas[1].get('street')).toBe('Rua dos Timbiras, Funcionários');
    expect(tentativas[2].get('q')).toBe('Rua dos Timbiras, Funcionários, Belo Horizonte, MG, Brasil');
    expect(tentativas[2].get('countrycodes')).toBe('br');
  });

  it('sem CEP pula a tentativa com postalcode', () => {
    const tentativas = montarTentativas(endereco);

    expect(tentativas).toHaveLength(2);
    expect(tentativas.every((parametros) => !parametros.has('postalcode'))).toBe(true);
  });
});

describe('GeocodificacaoGateway', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => {
    global.fetch = fetchOriginal;
    jest.useRealTimers();
  });

  function responder(...corpos: unknown[][]) {
    const mock = jest.fn();
    for (const corpo of corpos) mock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(corpo) });
    global.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  it('cai para o texto livre quando a busca estruturada não acha', async () => {
    jest.useFakeTimers();
    const mock = responder([], [{ lat: '-19.93', lon: '-43.93', display_name: 'Rua dos Timbiras' }]);

    const busca = new GeocodificacaoGateway().buscar(endereco);
    await jest.runAllTimersAsync();

    await expect(busca).resolves.toEqual({
      latitude: -19.93,
      longitude: -43.93,
      enderecoEncontrado: 'Rua dos Timbiras',
    });
    expect(mock).toHaveBeenCalledTimes(2);
    expect(String(mock.mock.calls[1][0])).toContain('q=');
  });

  it('não insiste quando o serviço responde erro', async () => {
    const mock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    global.fetch = mock as unknown as typeof fetch;

    await expect(new GeocodificacaoGateway().buscar(endereco)).resolves.toBeNull();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
