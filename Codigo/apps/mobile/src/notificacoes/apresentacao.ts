import type { TipoNotificacao } from '@montacontrol/shared';
import type { NomeIcone } from '@montacontrol/design-tokens/icones';
import type { IdAba } from '../navegacao/abas';

/** Papel de cor (token de `cores`) que a notificação usa na borda, no ícone e no fundo do ícone. */
export type TomDaNotificacao = 'primary' | 'tertiary' | 'error' | 'success';

/**
 * Tom por tipo. Os tipos do gestor/RH (`*_REPORTADA`, `*_ENVIADO`,
 * `*_SOLICITADO`, `PECA_INCONSISTENTE`) não chegam ao montador — o servidor
 * só os entrega a quem tem o perfil —, mas o mapa é total para o compilador
 * obrigar a decidir quando um tipo novo entrar em `TIPOS_NOTIFICACAO`.
 */
const TOM_POR_TIPO: Record<TipoNotificacao, TomDaNotificacao> = {
  AVARIA_REPORTADA: 'tertiary',
  AVARIA_ATUALIZADA: 'primary',
  ATESTADO_ENVIADO: 'primary',
  ATESTADO_VALIDADO: 'success',
  ATESTADO_REJEITADO: 'error',
  PECA_INCONSISTENTE: 'tertiary',
  PONTO_ATRASO_SOLICITADO: 'primary',
  PONTO_ATRASO_APROVADO: 'success',
  PONTO_ATRASO_REJEITADO: 'error',
};

export function tomDaNotificacao(tipo: TipoNotificacao): TomDaNotificacao {
  return TOM_POR_TIPO[tipo];
}

const ICONE_POR_TIPO: Record<TipoNotificacao, NomeIcone> = {
  AVARIA_REPORTADA: 'report',
  AVARIA_ATUALIZADA: 'report',
  ATESTADO_ENVIADO: 'description',
  ATESTADO_VALIDADO: 'description',
  ATESTADO_REJEITADO: 'description',
  PECA_INCONSISTENTE: 'warning',
  PONTO_ATRASO_SOLICITADO: 'schedule',
  PONTO_ATRASO_APROVADO: 'schedule',
  PONTO_ATRASO_REJEITADO: 'schedule',
};

export function iconeDaNotificacao(tipo: TipoNotificacao): NomeIcone {
  return ICONE_POR_TIPO[tipo];
}

/** Aba onde o montador vê o assunto da notificação; `null` quando não há destino (sem botão de ação). */
const ABA_POR_TIPO: Record<TipoNotificacao, IdAba | null> = {
  AVARIA_REPORTADA: null,
  AVARIA_ATUALIZADA: 'avarias',
  ATESTADO_ENVIADO: null,
  ATESTADO_VALIDADO: 'atestados',
  ATESTADO_REJEITADO: 'atestados',
  PECA_INCONSISTENTE: null,
  PONTO_ATRASO_SOLICITADO: null,
  PONTO_ATRASO_APROVADO: 'jornada',
  PONTO_ATRASO_REJEITADO: 'jornada',
};

export function abaDaNotificacao(tipo: TipoNotificacao): IdAba | null {
  return ABA_POR_TIPO[tipo];
}

/** Subtítulo da tela: "Você tem 3 novas mensagens" (singular e zero têm texto próprio). */
export function subtituloDeNaoLidas(naoLidas: number): string {
  if (naoLidas === 0) return 'Nenhuma mensagem nova';
  if (naoLidas === 1) return 'Você tem 1 nova mensagem';
  return `Você tem ${naoLidas} novas mensagens`;
}

const LIMITE_DO_SELO = 9;

/** Número do selo do sino: de 10 em diante vira `9+`, para não crescer além do botão. */
export function rotuloDoContador(naoLidas: number): string {
  return naoLidas > LIMITE_DO_SELO ? `${LIMITE_DO_SELO}+` : String(naoLidas);
}
