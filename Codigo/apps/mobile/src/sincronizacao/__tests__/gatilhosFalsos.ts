import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

type OuvinteRede = (estado: NetInfoState) => void;
type OuvinteAppState = (estado: AppStateStatus) => void;

/**
 * Troca `NetInfo.addEventListener` e `AppState.addEventListener` por versões
 * que de fato registram e removem ouvintes. O mock padrão do NetInfo devolve
 * um `jest.fn()` qualquer: chamar o ouvinte "removido" ainda funcionaria, e um
 * teste de "trocar de aba derruba o listener" passaria sem provar nada.
 */
export function instalarGatilhosFalsos() {
  const rede = new Set<OuvinteRede>();
  const appState = new Set<OuvinteAppState>();

  const adicionarRede = jest.mocked(NetInfo.addEventListener).mockImplementation((ouvinte) => {
    rede.add(ouvinte as OuvinteRede);
    return () => {
      rede.delete(ouvinte as OuvinteRede);
    };
  });

  const adicionarAppState = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_tipo, ouvinte) => {
      appState.add(ouvinte as OuvinteAppState);
      return { remove: () => void appState.delete(ouvinte as OuvinteAppState) };
    });

  return {
    /** Ouvintes de rede/AppState vivos agora. */
    rede,
    appState,
    /** Quantas vezes cada gatilho foi registrado desde o último `clearAllMocks`. */
    adicionarRede,
    adicionarAppState,
    emitirRede(conectado: boolean) {
      const estado = { isConnected: conectado, isInternetReachable: conectado } as NetInfoState;
      [...rede].forEach((ouvinte) => ouvinte(estado));
    },
    emitirAppState(estado: AppStateStatus) {
      [...appState].forEach((ouvinte) => ouvinte(estado));
    },
  };
}
