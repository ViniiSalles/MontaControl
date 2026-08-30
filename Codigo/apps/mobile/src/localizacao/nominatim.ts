/**
 * Reverse geocoding no Nominatim (OpenStreetMap).
 *
 * A política de uso do serviço é obrigatória e ele bloqueia quem a ignora:
 * `User-Agent` identificando a aplicação, e no máximo 1 requisição por
 * segundo. Por isso as chamadas passam por uma fila serial com intervalo
 * mínimo, e não por `Promise.all`.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const USER_AGENT_NOMINATIM =
  'MontaControl/1.0 (+https://github.com/ICEI-PUC-Minas-PMGES-TI/pmg-es-2026-1-tcci-6583100-dev-montacontrol-3)';

/** 1 req/s é o teto absoluto; 1100 ms dá folga para jitter de relógio. */
const INTERVALO_MINIMO_MS = 1100;
const TIMEOUT_MS = 5000;
/** 4 casas ≈ 11 m: perto o bastante para ser o mesmo endereço. */
const CASAS_DECIMAIS_CACHE = 4;

const cache = new Map<string, string | null>();
let fila: Promise<unknown> = Promise.resolve();

interface RespostaNominatim {
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
  display_name?: string;
}

function chaveCache(latitude: number, longitude: number): string {
  return `${latitude.toFixed(CASAS_DECIMAIS_CACHE)},${longitude.toFixed(CASAS_DECIMAIS_CACHE)}`;
}

function formatarEndereco(resposta: RespostaNominatim): string | null {
  const endereco = resposta.address;
  if (!endereco) return resposta.display_name ?? null;

  const logradouro = [endereco.road, endereco.house_number].filter(Boolean).join(', ');
  const cidade = endereco.city ?? endereco.town ?? endereco.village;
  const regiao = [endereco.suburb, cidade].filter(Boolean).join(', ');
  const completo = [logradouro, regiao].filter(Boolean).join(' — ');

  return completo || resposta.display_name || null;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function consultar(latitude: number, longitude: number): Promise<string | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=pt-BR`;

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT_NOMINATIM, Accept: 'application/json' },
      signal: controlador.signal,
    });
    if (!resposta.ok) return null;
    return formatarEndereco((await resposta.json()) as RespostaNominatim);
  } catch {
    // Sem rede, timeout ou resposta ilegível: o endereço é enfeite, o ponto
    // é o que importa. Nunca propaga.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Endereço legível da coordenada, ou `null` se não deu para resolver.
 * **Nunca lança** — o check-in não pode ficar refém do Nominatim.
 */
export async function resolverEndereco(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const chave = chaveCache(latitude, longitude);
  const emCache = cache.get(chave);
  if (emCache !== undefined) return emCache;

  const proxima = fila.then(async () => {
    const resultado = await consultar(latitude, longitude);
    cache.set(chave, resultado);
    // Segura a fila pelo intervalo mínimo antes de liberar a próxima.
    await esperar(INTERVALO_MINIMO_MS);
    return resultado;
  });

  fila = proxima.catch(() => undefined);
  return proxima;
}
