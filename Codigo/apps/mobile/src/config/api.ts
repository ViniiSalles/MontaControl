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

function lerUrlOpcional(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const normalizado = valor.trim();
  return normalizado.length > 0 ? normalizado : undefined;
}

/**
 * Base da API, nesta ordem:
 * 1. `EXPO_PUBLIC_API_URL` em `.env.local` (aparelho físico / rede local)
 * 2. `expo.extra.apiUrl` em `app.json` (builds / overrides)
 * 3. padrão de emulador por plataforma
 *
 * A web (`apps/web`) não precisa disso: fala com o mesmo-origin `/api/...`
 * via proxy do Vite (ver `apps/web/vite.config.ts`).
 */
export const urlBaseApi: string =
  lerUrlOpcional(process.env.EXPO_PUBLIC_API_URL) ??
  lerUrlOpcional(Constants.expoConfig?.extra?.apiUrl) ??
  (Platform.OS === 'android' ? PADRAO_POR_PLATAFORMA.android : PADRAO_POR_PLATAFORMA.ios);
