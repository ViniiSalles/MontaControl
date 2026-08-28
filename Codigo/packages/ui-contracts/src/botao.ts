import type { NomeIcone } from '@montacontrol/design-tokens/icones';

/** Ver `login_montacontrol:139` (CTA "Entrar", `rounded-full`, gradiente `primary` → `primary-container`). */
export type VarianteBotao = 'primario' | 'tonal' | 'fantasma' | 'perigo' | 'icone';

/** Altura do botão em px — alturas de alvo de toque tocáveis do design system. */
export type TamanhoBotao = 40 | 48 | 56;

/** `pilula` (`rounded-full`, ex. CTA principal) ou `retangular` (`raio.md`/`raio.lg`). */
export type FormaBotao = 'pilula' | 'retangular';

export interface PropsBotao {
  variante: VarianteBotao;
  tamanho: TamanhoBotao;
  forma: FormaBotao;
  texto?: string;
  /** Obrigatório quando `variante: 'icone'`. */
  icone?: NomeIcone;
  carregando?: boolean;
  larguraTotal?: boolean;
  desabilitado?: boolean;
  aoPressionar: () => void;
}
