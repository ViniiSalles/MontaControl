import { isIP } from 'net';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Cabeçalhos de IP que a borda do Render (Cloudflare) **sobrescreve** em toda
 * requisição — um valor forjado pelo cliente não chega à API. Por isso são os
 * únicos aceitos em `CLIENT_IP_HEADER`: `X-Forwarded-For` fica de fora de
 * propósito, porque o Render preserva o valor enviado pelo cliente e só
 * acrescenta entradas à direita.
 */
export const CABECALHOS_IP_CLIENTE = ['true-client-ip', 'cf-connecting-ip'] as const;

export type CabecalhoIpCliente = (typeof CABECALHOS_IP_CLIENTE)[number];

interface RequisicaoComIp {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Quantos proxies à direita do `X-Forwarded-For` o Express considera
 * confiáveis ao calcular `req.ip`. `0` (default) ignora o cabeçalho e usa o
 * endereço do socket — o único valor seguro sem proxy na frente, já que
 * qualquer cliente pode enviar `X-Forwarded-For`.
 */
export function configurarProxyConfiavel(app: NestExpressApplication, saltos: number): void {
  app.set('trust proxy', saltos);
}

/**
 * IP usado como chave do rate limit. Com `cabecalho` configurado e contendo
 * um IP válido, ele vence; senão vale `req.ip` (já resolvido pelo
 * `trust proxy`). Sem `cabecalho`, nenhum cabeçalho enviado pelo cliente é
 * lido — em dev local não há borda para sobrescrevê-lo.
 */
export function resolverIpCliente(req: RequisicaoComIp, cabecalho?: CabecalhoIpCliente): string {
  if (cabecalho) {
    const valor = req.headers[cabecalho];
    if (typeof valor === 'string' && isIP(valor.trim()) !== 0) {
      return valor.trim();
    }
  }
  return req.ip ?? '';
}

/** Limite global: 100 requisições por minuto por IP de cliente. */
export function criarOpcoesThrottler(config: ConfigService): ThrottlerModuleOptions {
  const cabecalho = config.get<CabecalhoIpCliente>('CLIENT_IP_HEADER');
  return {
    throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    getTracker: (req) => resolverIpCliente(req as RequisicaoComIp, cabecalho),
  };
}
