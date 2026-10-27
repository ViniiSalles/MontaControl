import { StatusPeca } from '@montacontrol/shared'
import type {
  AcompanhamentoPedidoDTO,
  EtapaPedido,
  ProdutividadeDiaDTO,
  TipoAlertaDashboard,
} from '@montacontrol/shared'
import type { NomeIcone } from '@montacontrol/design-tokens/icones'
import type { VarianteBadge } from '@montacontrol/ui-contracts/badge'

export const ROTULO_ETAPA: Record<EtapaPedido, string> = {
  AGUARDANDO_FABRICA: 'Aguardando fábrica',
  EM_TRIAGEM: 'Chegando ao estoque',
  NO_ESTOQUE: 'No estoque',
  EM_DESCARREGAMENTO: 'Descarregando no cliente',
  NO_CLIENTE: 'Entregue no cliente',
}

/** Onde a peça está, do ponto de vista do rastreio de bipagens. */
export const ROTULO_STATUS_PECA: Record<StatusPeca, string> = {
  [StatusPeca.PENDENTE]: 'Aguardando triagem',
  [StatusPeca.TRIADA]: 'No estoque',
  [StatusPeca.CARREGADA]: 'Carregada',
  [StatusPeca.DESCARREGADA]: 'No cliente',
  [StatusPeca.INCONSISTENTE]: 'Obra errada',
  [StatusPeca.ENTREGUE]: 'Entregue',
}

export const VARIANTE_STATUS_PECA: Record<StatusPeca, VarianteBadge> = {
  [StatusPeca.PENDENTE]: 'neutro',
  [StatusPeca.TRIADA]: 'info',
  [StatusPeca.CARREGADA]: 'info',
  [StatusPeca.DESCARREGADA]: 'sucesso',
  [StatusPeca.INCONSISTENTE]: 'aviso',
  [StatusPeca.ENTREGUE]: 'sucesso',
}

export const VARIANTE_ETAPA: Record<EtapaPedido, VarianteBadge> = {
  AGUARDANDO_FABRICA: 'neutro',
  EM_TRIAGEM: 'aviso',
  NO_ESTOQUE: 'info',
  EM_DESCARREGAMENTO: 'aviso',
  NO_CLIENTE: 'sucesso',
}

export const ICONE_ALERTA: Record<TipoAlertaDashboard, NomeIcone> = {
  CHECKIN: 'location_on',
  CHECKOUT: 'logout',
  AVARIA: 'report',
  TRIAGEM: 'conveyor_belt',
  DESCARREGAMENTO: 'home_work',
  INCONSISTENCIA: 'warning',
}

/** Classes do círculo do ícone por tipo — problema em tom de erro/alerta, rotina em tom neutro. */
export const TOM_ALERTA: Record<TipoAlertaDashboard, string> = {
  CHECKIN: 'bg-primary-fixed text-primary',
  CHECKOUT: 'bg-surface-container-high text-on-surface-variant',
  AVARIA: 'bg-error-container text-error',
  TRIAGEM: 'bg-primary-fixed text-primary',
  DESCARREGAMENTO: 'bg-success-container text-on-success-container',
  INCONSISTENCIA: 'bg-tertiary-fixed text-tertiary',
}

export type FiltroPedidos = 'andamento' | 'pendencias' | 'concluidos' | 'todos'

/** Pedido com problema que o gestor precisa tratar: peça na obra errada ou avaria aberta. */
export function temPendencia(pedido: AcompanhamentoPedidoDTO): boolean {
  return pedido.pecasInconsistentes > 0 || pedido.avariasAbertas > 0
}

export function filtrarPedidos(
  pedidos: readonly AcompanhamentoPedidoDTO[],
  filtro: FiltroPedidos,
): AcompanhamentoPedidoDTO[] {
  if (filtro === 'andamento') return pedidos.filter((pedido) => pedido.etapa !== 'NO_CLIENTE')
  if (filtro === 'pendencias') return pedidos.filter(temPendencia)
  if (filtro === 'concluidos') return pedidos.filter((pedido) => pedido.etapa === 'NO_CLIENTE')
  return [...pedidos]
}

/** 0-100, arredondado; sem peças não há progresso a mostrar. */
export function percentual(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100)
}

/** `agora`, `há 5 min`, `há 3 h`, `há 2 dias` — o feed traz os últimos eventos, que podem ser de dias atrás. */
export function tempoRelativo(iso: string, agora: Date): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

export interface ResumoProdutividade {
  totalTriadas: number
  totalDescarregadas: number
  mediaDiariaDescarregadas: number
  /** Maior valor diário entre as duas séries — topo da escala do gráfico. */
  maximo: number
}

export function resumirProdutividade(dias: readonly ProdutividadeDiaDTO[]): ResumoProdutividade {
  const totalTriadas = dias.reduce((soma, dia) => soma + dia.pecasTriadas, 0)
  const totalDescarregadas = dias.reduce((soma, dia) => soma + dia.pecasDescarregadas, 0)
  return {
    totalTriadas,
    totalDescarregadas,
    mediaDiariaDescarregadas: dias.length === 0 ? 0 : Math.round(totalDescarregadas / dias.length),
    maximo: Math.max(0, ...dias.map((dia) => Math.max(dia.pecasTriadas, dia.pecasDescarregadas))),
  }
}
