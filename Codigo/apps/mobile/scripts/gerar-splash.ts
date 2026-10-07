/**
 * Regenera `assets/splash-icon.png` (imagem da splash nativa) a partir dos
 * tokens de design. Fundo transparente: a cor de fundo da splash vem do
 * plugin `expo-splash-screen` em `app.json`.
 *
 * Uso (a partir de Codigo/): pnpm --filter @montacontrol/mobile gerar:splash
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderizarSplash } from './splash';

const destino = resolve(import.meta.dirname, '../assets/splash-icon.png');

writeFileSync(destino, renderizarSplash());
console.log(`splash regenerada em ${destino}`);
