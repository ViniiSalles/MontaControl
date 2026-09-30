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

const PORTA_API = 3000;

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function lerUrlOpcional(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const normalizado = valor.trim();
  return normalizado.length > 0 ? normalizado : undefined;
}

/**
 * Em desenvolvimento o Expo expõe em `hostUri` o `IP:porta` da máquina que
 * serve o bundle (ex.: `192.168.1.11:8081`) — a mesma onde a API roda. Usar
 * esse IP evita fixar um endereço que muda a cada troca de rede/DHCP. Só
 * vale IPv4: em modo túnel o host é um domínio `*.exp.direct`, que não
 * chega na API.
 */
function urlDoServidorDeDesenvolvimento(hostUri: unknown): string | undefined {
  if (typeof hostUri !== 'string') return undefined;
  const host = hostUri.split(':')[0];
  return IPV4.test(host) ? `http://${host}:${PORTA_API}` : undefined;
}

interface EntradasUrlBaseApi {
  env: unknown;
  extra: unknown;
  hostUri: unknown;
  plataforma: 'android' | 'ios' | string;
}

export function resolverUrlBaseApi({ env, extra, hostUri, plataforma }: EntradasUrlBaseApi): string {
  return (
    lerUrlOpcional(env) ??
    lerUrlOpcional(extra) ??
    urlDoServidorDeDesenvolvimento(hostUri) ??
    (plataforma === 'android' ? PADRAO_POR_PLATAFORMA.android : PADRAO_POR_PLATAFORMA.ios)
  );
}

/**
 * Base da API, nesta ordem:
 * 1. `EXPO_PUBLIC_API_URL` em `.env.local` (override explícito)
 * 2. `expo.extra.apiUrl` em `app.json` (builds / overrides)
 * 3. IP do servidor de desenvolvimento do Expo (detectado sozinho; aparelho
 *    físico e emulador, sem precisar editar nada quando o IP muda)
 * 4. padrão de emulador por plataforma
 *
 * A web (`apps/web`) não precisa disso: fala com o mesmo-origin `/api/...`
 * via proxy do Vite (ver `apps/web/vite.config.ts`).
 */
export const urlBaseApi: string = resolverUrlBaseApi({
  env: process.env.EXPO_PUBLIC_API_URL,
  extra: Constants.expoConfig?.extra?.apiUrl,
  hostUri: Constants.expoConfig?.hostUri,
  plataforma: Platform.OS,
});
