import { Injectable, Logger } from '@nestjs/common';
import type { CoordenadasEncontradasDTO, GeocodificarEnderecoRequest } from '@montacontrol/shared';

/**
 * Busca de coordenadas no Nominatim (OpenStreetMap). A política de uso exige
 * `User-Agent` identificando a aplicação e no máximo 1 requisição por segundo
 * — é o gestor que dispara, um clique por vez, e as tentativas de uma mesma
 * busca respeitam o intervalo entre si.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT =
  'MontaControl/1.0 (+https://github.com/ICEI-PUC-Minas-PMGES-TI/pmg-es-2026-1-tcci-6583100-dev-montacontrol-3)';
const TIMEOUT_MS = 5000;
const INTERVALO_ENTRE_TENTATIVAS_MS = 1000;

interface ResultadoNominatim {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * A busca estruturada é precisa, mas não acha nada quando o CEP é genérico
 * (ex.: 32000-000) ou quando o endereço vem do ViaCEP como "Rua, Bairro" sem
 * número. Por isso tenta do mais específico ao mais tolerante (texto livre).
 */
export function montarTentativas(endereco: GeocodificarEnderecoRequest): URLSearchParams[] {
  const comuns = { format: 'json', limit: '1', 'accept-language': 'pt-BR' };
  const estruturada = {
    ...comuns,
    street: endereco.endereco,
    city: endereco.cidade,
    state: endereco.estado,
    country: 'Brasil',
  };
  const tentativas: URLSearchParams[] = [];
  if (endereco.cep) tentativas.push(new URLSearchParams({ ...estruturada, postalcode: endereco.cep }));
  tentativas.push(new URLSearchParams(estruturada));
  tentativas.push(
    new URLSearchParams({
      ...comuns,
      q: [endereco.endereco, endereco.cidade, endereco.estado, 'Brasil'].join(', '),
      countrycodes: 'br',
    }),
  );
  return tentativas;
}

@Injectable()
export class GeocodificacaoGateway {
  private readonly logger = new Logger(GeocodificacaoGateway.name);

  /** `null` quando o endereço não foi encontrado ou o serviço não respondeu. */
  async buscar(endereco: GeocodificarEnderecoRequest): Promise<CoordenadasEncontradasDTO | null> {
    const tentativas = montarTentativas(endereco);
    for (const [indice, parametros] of tentativas.entries()) {
      if (indice > 0) await esperar(INTERVALO_ENTRE_TENTATIVAS_MS);
      const resultado = await this.consultar(parametros);
      if (resultado === 'falha') return null;
      if (resultado) return resultado;
    }
    return null;
  }

  /** `'falha'` quando o serviço não respondeu — não adianta insistir. */
  private async consultar(parametros: URLSearchParams): Promise<CoordenadasEncontradasDTO | null | 'falha'> {
    try {
      const resposta = await fetch(`${URL_NOMINATIM}?${parametros.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        this.logger.warn(`Nominatim respondeu ${resposta.status}`);
        return 'falha';
      }
      const [primeiro] = (await resposta.json()) as ResultadoNominatim[];
      if (!primeiro) return null;
      return {
        latitude: Number(primeiro.lat),
        longitude: Number(primeiro.lon),
        enderecoEncontrado: primeiro.display_name,
      };
    } catch (erro) {
      this.logger.warn(`Falha ao consultar o Nominatim: ${erro instanceof Error ? erro.message : erro}`);
      return 'falha';
    }
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
