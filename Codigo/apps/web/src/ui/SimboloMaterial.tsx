import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import cancel from '@material-symbols/svg-400/outlined/cancel.svg?raw'
import checkCircle from '@material-symbols/svg-400/outlined/check_circle.svg?raw'
import conveyorBelt from '@material-symbols/svg-400/outlined/conveyor_belt.svg?raw'
import info from '@material-symbols/svg-400/outlined/info.svg?raw'
import lock from '@material-symbols/svg-400/outlined/lock.svg?raw'
import mail from '@material-symbols/svg-400/outlined/mail.svg?raw'
import visibility from '@material-symbols/svg-400/outlined/visibility.svg?raw'
import visibilityOff from '@material-symbols/svg-400/outlined/visibility_off.svg?raw'
import warning from '@material-symbols/svg-400/outlined/warning.svg?raw'

// Os SVGs de @material-symbols/svg-400 não têm `fill` — herdam preto do
// default do SVG. Injeta `fill="currentColor"` na tag raiz (os `<path>`
// filhos não sobrescrevem `fill`, então herdam) para o ícone seguir a cor
// de texto do Tailwind (`text-*`), como no mockup Stitch.
const comCorAtual = (bruto: string) => bruto.replace('<svg ', '<svg fill="currentColor" ')

const svgPorIcone: Record<NomeIcone, string> = {
  cancel: comCorAtual(cancel),
  check_circle: comCorAtual(checkCircle),
  conveyor_belt: comCorAtual(conveyorBelt),
  info: comCorAtual(info),
  lock: comCorAtual(lock),
  mail: comCorAtual(mail),
  visibility: comCorAtual(visibility),
  visibility_off: comCorAtual(visibilityOff),
  warning: comCorAtual(warning),
}

export interface PropsSimboloMaterial {
  nome: NomeIcone
  className?: string
}

/**
 * Ícone Material Symbols (Outlined) como SVG inline — evita auto-hospedar a
 * fonte variável inteira (~4MB) só para os nomes que `NomeIcone` cobre hoje.
 * Não é o `<Icone>` compartilhado do plano (Componentes #6, primitiva
 * mobile-only por ora, ver README de `@montacontrol/ui-contracts`): é
 * detalhe de implementação interno a este app.
 */
export function SimboloMaterial({ nome, className }: PropsSimboloMaterial) {
  return (
    <span
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgPorIcone[nome] }}
    />
  )
}
