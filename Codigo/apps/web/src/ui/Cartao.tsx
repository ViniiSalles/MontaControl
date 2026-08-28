import type { NivelElevacaoCartao, PropsCartao, TomCartao } from '@montacontrol/ui-contracts/cartao'

const sombraPorNivel: Record<NivelElevacaoCartao, string> = {
  none: 'shadow-none',
  elev1: 'shadow-elev1',
  elev2: 'shadow-elev2',
  elev3: 'shadow-elev3',
  elev4: 'shadow-elev4',
}

const corPorTom: Record<TomCartao, string> = {
  padrao: 'bg-surface-container-lowest text-on-surface',
  baixo: 'bg-surface-container-low text-on-surface',
  inverso: 'bg-inverse-surface text-inverse-on-surface',
}

const corRodape: Record<TomCartao, string> = {
  padrao: 'bg-surface-container-low',
  baixo: 'bg-surface-container',
  inverso: 'bg-inverse-surface',
}

/**
 * Ver `jornada_home:111`. Sem linha divisória entre corpo e rodapé (DESIGN.md
 * §5, "Cards: Forbid divider lines") — separação é só por mudança de tom.
 */
export function Cartao({ elevacao, tom, conteudo, rodape }: PropsCartao) {
  return (
    <div className={['overflow-hidden rounded-lg', sombraPorNivel[elevacao], corPorTom[tom]].join(' ')}>
      <div className="p-16">{conteudo}</div>
      {rodape && <div className={['p-16', corRodape[tom]].join(' ')}>{rodape}</div>}
    </div>
  )
}
