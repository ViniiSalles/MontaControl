import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Roda uma vez por worker Jest, antes do módulo da suíte carregar — garante
 * que `ConfigModule.forRoot()` (que também tenta ler `.env`) enxergue as
 * variáveis de `.env.test` (MontaControlDev) e não as de `.env` (dev local).
 */
config({ path: resolve(__dirname, '../../.env.test'), override: true, quiet: true });
