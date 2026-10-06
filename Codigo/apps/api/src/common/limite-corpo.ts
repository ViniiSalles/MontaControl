import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Fotos (atestado, avaria, montador) chegam em base64 no JSON. O padrão do
 * Express é 100 KB — qualquer foto real de celular estourava com 413. O teto
 * cobre 3 fotos de 5 MB (limite por foto validado nos services) já infladas
 * em ~33% pelo base64.
 */
export const LIMITE_CORPO_JSON = '25mb';

export function configurarLimiteCorpo(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: LIMITE_CORPO_JSON });
}
