import { SvgXml } from 'react-native-svg';
import type { PropsIcone } from '@montacontrol/ui-contracts/icone';
import { svgPorIconeENivel } from './icones-svg';

/**
 * Mesma técnica da Web (`SimboloMaterial.tsx`), adaptada para `react-native-svg`:
 * os SVGs de `@material-symbols/svg-400` vêm com `width`/`height` fixos em
 * 48 — sem trocar por `tamanho`, o ícone sempre renderiza a 48px
 * (bug já corrigido na Web, ver `apps/web/src/ui/SimboloMaterial.tsx:16`).
 * `preenchido` troca de arquivo (`-fill`), não de eixo de fonte variável —
 * ver "Desvio de plano" no topo deste documento.
 */
export function Icone({ nome, tamanho = 24, cor, preenchido = false }: PropsIcone) {
  const bruto = svgPorIconeENivel(nome, preenchido);
  const comTamanhoECor = bruto
    .replace(/width="\d+"/, `width="${tamanho}"`)
    .replace(/height="\d+"/, `height="${tamanho}"`)
    .replace('<svg ', `<svg fill="${cor ?? 'currentColor'}" `);
  return <SvgXml xml={comTamanhoECor} width={tamanho} height={tamanho} />;
}
