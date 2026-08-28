import type { ReactNode } from 'react';

export type ApresentacaoModal = 'centro' | 'folha' | 'tela';

export interface AcaoModal {
  texto: string;
  aoPressionar: () => void;
  variante?: 'primario' | 'fantasma';
}

/** Ver `gest_o_de_ferramentas:378-449` — header (título + fechar) / conteúdo rolável / rodapé de ações. */
export interface PropsModal {
  visivel: boolean;
  apresentacao: ApresentacaoModal;
  titulo: string;
  conteudo: ReactNode;
  acoes?: AcaoModal[];
  aoFechar: () => void;
}
