import { SvgXml } from 'react-native-svg';
import type { PropsIcone } from '@montacontrol/ui-contracts/icone';
import { cores, espacamentoNomeado } from '@montacontrol/design-tokens/native';
import { svgPorIconeENivel } from './icones-svg';

/**
 * Mesma técnica da Web (`SimboloMaterial.tsx`), adaptada para `react-native-svg`:
 * os SVGs de `@material-symbols/svg-400` vêm com `width`/`height` fixos em
 * 48 — sem trocar por `tamanho`, o ícone sempre renderiza a 48px
 * (bug já corrigido na Web, ver `apps/web/src/ui/SimboloMaterial.tsx:16`).
 * `preenchido` troca de arquivo (`-fill`), não de eixo de fonte variável —
 * ver "Desvio de plano" no topo deste documento.
 *
 * `react-native-svg` não tem cascata CSS, então `currentColor` não é um
 * valor resolvível (renderizaria preto opaco) — o default de `cor` segue o
 * mesmo default de `Texto.tsx` (`cores.onSurface`), e o default de
 * `tamanho` usa o token nomeado do contrato (`gradeIcone`, ver
 * `packages/ui-contracts/src/icone.ts`), nunca um literal solto.
 */
export function Icone({
  nome,
  tamanho = espacamentoNomeado.gradeIcone,
  cor = cores.onSurface,
  preenchido = false,
}: PropsIcone) {
  const bruto = svgPorIconeENivel(nome, preenchido);
  const comTamanhoECor = bruto
    .replace(/width="\d+"/, `width="${tamanho}"`)
    .replace(/height="\d+"/, `height="${tamanho}"`)
    .replace('<svg ', `<svg fill="${cor}" `);
  return <SvgXml xml={comTamanhoECor} width={tamanho} height={tamanho} />;
}
