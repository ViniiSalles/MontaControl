import { calcularDistanciaMetros } from '@montacontrol/shared';

describe('calcularDistanciaMetros', () => {
  it('retorna zero quando as duas coordenadas são iguais', () => {
    const ponto = { latitude: -19.9325, longitude: -43.9382 };

    expect(calcularDistanciaMetros(ponto, ponto)).toBe(0);
  });

  it('calcula a distância aproximada entre dois pontos conhecidos', () => {
    // 1º de latitude no equador equivale a ~111.195km (raio médio da Terra) —
    // valor de referência independente da implementação, para não testar a
    // fórmula contra si mesma.
    const distancia = calcularDistanciaMetros(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );

    expect(Math.abs(distancia - 111195)).toBeLessThan(50);
  });
});
