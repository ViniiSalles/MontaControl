export interface Coordenada {
  latitude: number;
  longitude: number;
}

const RAIO_TERRA_METROS = 6_371_000;

function paraRadianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/**
 * Distância em linha reta entre duas coordenadas (fórmula de Haversine).
 * Ignora altitude e curvatura fina do terreno — suficiente para comparar
 * contra um raio de tolerância em metros.
 */
export function calcularDistanciaMetros(a: Coordenada, b: Coordenada): number {
  const deltaLat = paraRadianos(b.latitude - a.latitude);
  const deltaLon = paraRadianos(b.longitude - a.longitude);

  const senoMetadeLat = Math.sin(deltaLat / 2);
  const senoMetadeLon = Math.sin(deltaLon / 2);

  const h =
    senoMetadeLat * senoMetadeLat +
    Math.cos(paraRadianos(a.latitude)) *
      Math.cos(paraRadianos(b.latitude)) *
      senoMetadeLon *
      senoMetadeLon;

  return 2 * RAIO_TERRA_METROS * Math.asin(Math.sqrt(h));
}
