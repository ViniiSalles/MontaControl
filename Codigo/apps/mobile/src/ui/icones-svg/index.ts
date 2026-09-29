import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import { dadosSvgPorIcone } from './dados';

export function svgPorIconeENivel(nome: NomeIcone, preenchido: boolean): string {
  const par = dadosSvgPorIcone[nome];
  if (!par) throw new Error(`Ícone "${nome}" sem SVG vendorizado — rodar pnpm --filter @montacontrol/mobile gerar:icones`);
  return preenchido ? par.fill : par.base;
}
