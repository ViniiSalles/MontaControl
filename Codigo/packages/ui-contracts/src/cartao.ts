import type { ReactNode } from 'react';

/**
 * Chaves de `elevacao` de `@montacontrol/design-tokens` aplicáveis a cartão
 * (não referenciamos o módulo em runtime — pacote é zero-runtime — só
 * espelhamos o vocabulário de chaves para passagem direta pelo consumidor).
 */
export type NivelElevacaoCartao = 'none' | 'elev1' | 'elev2' | 'elev3' | 'elev4';

/** `padrao` = `surface-container-lowest`; `baixo` = `surface-container-low`; `inverso` = `inverse-surface`. */
export type TomCartao = 'padrao' | 'baixo' | 'inverso';

/**
 * Ver `jornada_home:111`. Sem linha divisória entre corpo e rodapé (DESIGN.md
 * §5, "Cards: Forbid divider lines") — separação é só por mudança de tom
 * (`surface-container-lowest` no corpo, `surface-container-low` no rodapé).
 */
export interface PropsCartao {
  elevacao: NivelElevacaoCartao;
  tom: TomCartao;
  conteudo: ReactNode;
  rodape?: ReactNode;
}
