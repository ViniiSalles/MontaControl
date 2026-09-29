import type { NomeIcone } from '@montacontrol/design-tokens/icones';

/** `'senha'` liga o toggle de visibilidade embutido (ícone `visibility`/`visibility_off`). */
export type TipoCampoTexto = 'texto' | 'email' | 'senha' | 'numero';

/** Slot de ação junto ao rótulo — ex. "Esqueci minha senha" (`login_montacontrol:122-124`). */
export interface AcaoRotuloCampoTexto {
  texto: string;
  aoPressionar: () => void;
}

/**
 * Ver `login_montacontrol:107-116`: fundo `surface-container-low`, sem borda
 * (DESIGN.md §5 — "No full-box borders"), acento inferior de 2px animado em
 * `primary` no foco.
 */
export interface PropsCampoTexto {
  rotulo: string;
  valor: string;
  aoAlterar: (valor: string) => void;
  tipo?: TipoCampoTexto;
  placeholder?: string;
  iconeEsquerda?: NomeIcone;
  acaoRotulo?: AcaoRotuloCampoTexto;
  /** Mensagem de erro — quando presente, substitui `ajuda` e marca o campo como inválido. */
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  desabilitado?: boolean;
  /** Várias linhas; só a implementação mobile usa por ora. */
  multilinha?: boolean;
}
