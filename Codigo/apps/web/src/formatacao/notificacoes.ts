import { Perfil } from '@montacontrol/shared'
import type { NotificacaoDTO, TipoNotificacao } from '@montacontrol/shared'
import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import type { PerfilWeb } from '../auth/perfilDestino'

export const ICONE_NOTIFICACAO: Record<TipoNotificacao, NomeIcone> = {
  AVARIA_REPORTADA: 'report',
  AVARIA_ATUALIZADA: 'info',
  ATESTADO_ENVIADO: 'description',
  ATESTADO_VALIDADO: 'check_circle',
  ATESTADO_REJEITADO: 'cancel',
  PECA_INCONSISTENTE: 'warning',
  PONTO_ATRASO_SOLICITADO: 'schedule',
  PONTO_ATRASO_APROVADO: 'check_circle',
  PONTO_ATRASO_REJEITADO: 'cancel',
}

/** Classes do círculo do ícone — problema/recusa em tom de erro, aviso em terciário, conclusão positiva em sucesso. */
export const TOM_NOTIFICACAO: Record<TipoNotificacao, string> = {
  AVARIA_REPORTADA: 'bg-error-container text-error',
  AVARIA_ATUALIZADA: 'bg-primary-fixed text-primary',
  ATESTADO_ENVIADO: 'bg-primary-fixed text-primary',
  ATESTADO_VALIDADO: 'bg-success-container text-on-success-container',
  ATESTADO_REJEITADO: 'bg-error-container text-error',
  PECA_INCONSISTENTE: 'bg-tertiary-fixed text-tertiary',
  PONTO_ATRASO_SOLICITADO: 'bg-primary-fixed text-primary',
  PONTO_ATRASO_APROVADO: 'bg-success-container text-on-success-container',
  PONTO_ATRASO_REJEITADO: 'bg-error-container text-error',
}

/**
 * Destino do botão "Ver detalhes" na web, ou `null` quando não há tela para
 * levar o usuário (o botão some). Os tipos endereçados ao montador
 * (atestado validado/rejeitado, ponto aprovado/rejeitado, avaria atualizada)
 * não têm destino aqui; o DEPOSITO não tem tela de avarias.
 */
export function rotaDaNotificacao(notificacao: NotificacaoDTO, perfil: PerfilWeb): string | null {
  if (perfil === Perfil.GESTOR) {
    if (notificacao.tipo === 'AVARIA_REPORTADA') return '/avarias'
    if (notificacao.tipo === 'PECA_INCONSISTENTE') return '/dashboard'
    return null
  }
  if (perfil === Perfil.RH) {
    if (notificacao.tipo === 'ATESTADO_ENVIADO') return '/atestados'
    // As solicitações de compensação são a aba de aprovação em Banco de Horas.
    if (notificacao.tipo === 'PONTO_ATRASO_SOLICITADO') return '/banco-horas'
    return null
  }
  return null
}
