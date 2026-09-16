import type { NomeIcone } from '@montacontrol/design-tokens/icones';

/**
 * Identificador de aba. A Sprint 1 só entrega `jornada` navegável; as
 * demais existem para que a barra inferior tenha a forma final do design
 * (`jornada_home:216-242`) desde já, em vez de crescer aba a aba e mudar
 * de layout a cada sprint.
 */
export type IdAba = 'jornada' | 'bipagem' | 'avarias' | 'atestados' | 'normas';

export interface DefinicaoAba {
  id: IdAba;
  rotulo: string;
  icone: NomeIcone;
  /** Sprint em que a tela da aba entra; enquanto não chega, a aba fica desabilitada. */
  disponivel: boolean;
}

/** Aba padrão do MONTADOR ao autenticar (plano, "Destinos de N1T1"). */
export const ABA_PADRAO: IdAba = 'jornada';

export const ABAS: readonly DefinicaoAba[] = [
  { id: 'jornada', rotulo: 'Jornada', icone: 'event_note', disponivel: true },
  { id: 'bipagem', rotulo: 'Bipagem', icone: 'barcode_scanner', disponivel: false },
  { id: 'avarias', rotulo: 'Avarias', icone: 'report', disponivel: false },
  { id: 'atestados', rotulo: 'Atestados', icone: 'description', disponivel: true },
  { id: 'normas', rotulo: 'Normas', icone: 'menu_book', disponivel: false },
];
