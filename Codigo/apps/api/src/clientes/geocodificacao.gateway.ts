import { Injectable, Logger } from '@nestjs/common';
import type { CoordenadasEncontradasDTO, GeocodificarEnderecoRequest } from '@montacontrol/shared';

/**
 * Busca de coordenadas no Nominatim (OpenStreetMap). A política de uso exige
 * `User-Agent` identificando a aplicação e no máximo 1 requisição por segundo
 * — é o gestor que dispara, um clique por vez, então não há rajada.
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT =
  'MontaControl/1.0 (+https://github.com/ICEI-PUC-Minas-PMGES-TI/pmg-es-2026-1-tcci-6583100-dev-montacontrol-3)';
const TIMEOUT_MS = 5000;

interface ResultadoNominatim {
  lat: string;
  lon: string;
  display_name: string;
}

@Injectable()
export class GeocodificacaoGateway {
  private readonly logger = new Logger(GeocodificacaoGateway.name);

  /** `null` quando o endereço não foi encontrado ou o serviço não respondeu. */
  async buscar(endereco: GeocodificarEnderecoRequest): Promise<CoordenadasEncontradasDTO | null> {
    const parametros = new URLSearchParams({
      street: endereco.endereco,
      city: endereco.cidade,
      state: endereco.estado,
      country: 'Brasil',
      format: 'json',
      limit: '1',
      'accept-language': 'pt-BR',
    });
    if (endereco.cep) parametros.set('postalcode', endereco.cep);

    try {
      const resposta = await fetch(`${URL_NOMINATIM}?${parametros.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        this.logger.warn(`Nominatim respondeu ${resposta.status}`);
        return null;
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
      return null;
    }
  }
}
