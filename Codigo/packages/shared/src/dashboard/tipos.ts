import type { StatusPedido } from '../enums';

/**
 * Dashboard do gestor (US08/US09, Figura 37): onde está cada pedido — na
 * fábrica, no estoque (bipado na triagem pelo operador) ou no cliente
 * (bipado no descarregamento pelo montador) — e o que aconteceu na operação.
 */

/**
 * Etapa logística do pedido, derivada das peças:
 * - `AGUARDANDO_FABRICA`: nenhuma peça chegou ao estoque;
 * - `EM_TRIAGEM`: parte das peças já foi bipada no estoque;
 * - `NO_ESTOQUE`: todas no estoque, nenhuma descarregada no cliente;
 * - `EM_DESCARREGAMENTO`: parte já descarregada no cliente;
 * - `NO_CLIENTE`: todas descarregadas no cliente.
 */
export type EtapaPedido =
  | 'AGUARDANDO_FABRICA'
  | 'EM_TRIAGEM'
  | 'NO_ESTOQUE'
  | 'EM_DESCARREGAMENTO'
  | 'NO_CLIENTE';

export interface AcompanhamentoPedidoDTO {
  pedidoId: number;
  numeroPedido: string;
  statusPedido: StatusPedido;
  cliente: { nome: string; cidade: string; estado: string };
  /** Nomes dos montadores atribuídos à obra. */
  montadores: string[];
  etapa: EtapaPedido;
  totalPecas: number;
  /** Peças que já passaram pela triagem (chegaram ao estoque), inclusive as que seguiram adiante. */
  pecasNoEstoque: number;
  /** Peças conferidas no descarregamento (DESCARREGADA ou ENTREGUE). */
  pecasNoCliente: number;
  /** Peças bipadas na obra errada (INCONSISTENTE). */
  pecasInconsistentes: number;
  /** Avarias das peças do pedido ainda não resolvidas. */
  avariasAbertas: number;
  /** Última bipagem na triagem (ISO) — quando a carga chegou ao estoque. */
  ultimaTriagemEm: string | null;
  /** Última bipagem no descarregamento (ISO) — quando a carga chegou ao cliente. */
  ultimoDescarregamentoEm: string | null;
}

export interface IndicadoresDashboardDTO {
  /** Montadores com jornada aberta hoje. */
  montadoresEmCampo: number;
  avariasHoje: number;
  avariasAbertas: number;
  pecasTriadasHoje: number;
  pecasDescarregadasHoje: number;
  pecasInconsistentes: number;
  /** EPIs ativos que vencem nos próximos 30 dias (ou já vencidos). */
  episVencendo: number;
}

export type TipoAlertaDashboard =
  | 'CHECKIN'
  | 'CHECKOUT'
  | 'AVARIA'
  | 'TRIAGEM'
  | 'DESCARREGAMENTO'
  | 'INCONSISTENCIA';

export interface AlertaDashboardDTO {
  /** Estável entre atualizações (a lista é recalculada a cada consulta). */
  id: string;
  tipo: TipoAlertaDashboard;
  titulo: string;
  descricao: string;
  /** Instante do evento (ISO). */
  em: string;
}

export interface ProdutividadeDiaDTO {
  /** Dia civil no fuso da operação (`YYYY-MM-DD`). */
  dia: string;
  pecasTriadas: number;
  pecasDescarregadas: number;
}

export interface DashboardDTO {
  geradoEm: string;
  indicadores: IndicadoresDashboardDTO;
  pedidos: AcompanhamentoPedidoDTO[];
  /** Eventos das últimas 24 h, do mais recente para o mais antigo. */
  alertas: AlertaDashboardDTO[];
  /** Últimos 7 dias, do mais antigo para hoje. */
  produtividade: ProdutividadeDiaDTO[];
}
