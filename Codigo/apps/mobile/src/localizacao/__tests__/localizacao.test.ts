jest.mock('expo-location');

import * as Location from 'expo-location';
import { capturarLocalizacao } from '../localizacao';

describe('capturarLocalizacao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devolve as coordenadas quando tudo está disponível', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: -19.9325, longitude: -43.9382, accuracy: 12 },
    });

    await expect(capturarLocalizacao()).resolves.toEqual({
      tipo: 'ok',
      latitude: -19.9325,
      longitude: -43.9382,
      precisaoM: 12,
    });
  });

  it('distingue serviço de localização desligado', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

    await expect(capturarLocalizacao()).resolves.toEqual({ tipo: 'servico_desligado' });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('distingue permissão negada', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await expect(capturarLocalizacao()).resolves.toEqual({ tipo: 'permissao_negada' });
  });

  it('falha de leitura vira indisponível, não exceção', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('timeout'));

    await expect(capturarLocalizacao()).resolves.toEqual({ tipo: 'indisponivel' });
  });
});
