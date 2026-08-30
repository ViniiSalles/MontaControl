import * as Location from 'expo-location';

/**
 * Os quatro desfechos são separados porque a ação do montador difere em cada
 * um: permissão negada manda abrir os ajustes do app, serviço desligado manda
 * ligar o GPS, indisponível é "tente de novo". Um único `null` obrigaria a
 * tela a mostrar uma mensagem genérica e inútil.
 */
export type ResultadoLocalizacao =
  | { tipo: 'ok'; latitude: number; longitude: number; precisaoM: number | null }
  | { tipo: 'permissao_negada' }
  | { tipo: 'servico_desligado' }
  | { tipo: 'indisponivel' };

export async function capturarLocalizacao(): Promise<ResultadoLocalizacao> {
  try {
    // Checar o serviço antes da permissão: pedir permissão com o GPS
    // desligado produz um diálogo que o montador aceita e mesmo assim não
    // resolve o problema dele.
    const servicoLigado = await Location.hasServicesEnabledAsync();
    if (!servicoLigado) return { tipo: 'servico_desligado' };

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { tipo: 'permissao_negada' };

    const posicao = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      tipo: 'ok',
      latitude: posicao.coords.latitude,
      longitude: posicao.coords.longitude,
      precisaoM: posicao.coords.accuracy ?? null,
    };
  } catch {
    return { tipo: 'indisponivel' };
  }
}
