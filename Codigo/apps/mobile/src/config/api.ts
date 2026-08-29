import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * O emulador Android roda numa VM com a própria interface de rede, então
 * `localhost` ali é o próprio emulador, não a máquina do desenvolvedor —
 * `10.0.2.2` é o alias que a AVD expõe para o host. O simulador iOS
 * compartilha a rede do host e resolve `localhost` normalmente.
 */
const PADRAO_POR_PLATAFORMA = {
  android: 'http://10.0.2.2:3000',
  ios: 'http://localhost:3000',
} as const;

/**
 * Base da API. Sobrescreva por ambiente em `app.json` (`expo.extra.apiUrl`)
 * — em dispositivo físico é obrigatório, porque nem `localhost` nem
 * `10.0.2.2` alcançam a máquina do desenvolvedor a partir do aparelho: use
 * o IP dela na rede local (ex.: `http://192.168.0.10:3000`).
 *
 * A web (`apps/web`) não precisa disso: fala com o mesmo-origin `/api/...`
 * via proxy do Vite (ver `apps/web/vite.config.ts`).
 */
export const urlBaseApi: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  (Platform.OS === 'android' ? PADRAO_POR_PLATAFORMA.android : PADRAO_POR_PLATAFORMA.ios);
