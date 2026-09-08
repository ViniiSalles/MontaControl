import {
  Perfil,
  StatusAtestado,
  StatusAvaria,
  StatusJornada,
  StatusPeca,
  StatusPedido,
  StatusSolicitacaoPonto,
} from './enums';

/** DTOs compartilhados entre API, Web e Mobile. */

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario: UsuarioDTO;
}

export interface RefreshRequest {
  refreshToken: string;
}

/**
 * Corpo padrão de toda resposta de erro HTTP da API (`HttpExceptionFilter`).
 * `codigo` é discriminado para exceções de domínio (`CREDENCIAIS_INVALIDAS`,
 * `TOKEN_EXPIRADO` — contrato R12, ver plano) e cai no nome da classe da
 * exceção para os demais casos.
 */
export interface CorpoErroPadrao {
  codigo: string;
  message: string;
}

export interface RecuperarSenhaRequest {
  email: string;
}

export interface RedefinirSenhaRequest {
  email: string;
  token: string;
  novaSenha: string;
}

export interface UsuarioDTO {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}

export interface CadastrarUsuarioRequest {
  nome: string;
  email: string;
  senha: string;
  perfil: Perfil;
}

export interface CheckinRequest {
  /**
   * UUID gerado no aparelho. Chave de idempotência da outbox: se a resposta
   * do POST se perder na rede, a retentativa carrega o mesmo id e o servidor
   * devolve a jornada já criada em vez de criar uma segunda.
   */
  idCliente: string;
  latitude: number;
  longitude: number;
  /** Timestamp do dispositivo no instante do toque — não a hora de chegada na API. */
  registradoEm: string;
  /** Endereço resolvido pelo Nominatim; ausente quando o check-in foi feito offline. */
  endereco?: string;
  /** Pedido ao qual a marcação se refere. Quando ausente, a distância não é validada. */
  pedidoId?: number;
}

export interface CheckoutRequest {
  idCliente: string;
  latitude: number;
  longitude: number;
  registradoEm: string;
  endereco?: string;
  /** Pedido ao qual a marcação se refere. Quando ausente, a distância não é validada. */
  pedidoId?: number;
}

export interface JornadaDTO {
  id: number;
  usuarioId: number;
  status: StatusJornada;
  checkinAt: string | null;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkinEndereco: string | null;
  checkoutAt: string | null;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  checkoutEndereco: string | null;
  /** Nasceu de um ponto em atraso aprovado — não tem coordenada. */
  lancadoEmAtraso: boolean;
  /** Criação da linha no servidor, ISO 8601. Cursor do pull de sincronização. */
  criadoEm: string;
}

/** Períodos oferecidos pelo seletor da tela de histórico. */
export type PeriodoHistorico = 5 | 15 | 30;

export interface DiaJornadaDTO {
  /** `YYYY-MM-DD` no fuso de operação, não em UTC. */
  data: string;
  /** Menor `checkinAt` do dia, ISO 8601. */
  inicio: string | null;
  /** Maior `checkoutAt` do dia. `null` enquanto a última jornada do dia estiver aberta. */
  fim: string | null;
  minutosTrabalhados: number;
  /** Alguma jornada do dia sem check-out. */
  emAndamento: boolean;
  jornadas: JornadaDTO[];
}

export interface HistoricoJornadasDTO {
  periodoDias: PeriodoHistorico;
  inicioPeriodo: string;
  fimPeriodo: string;
  /** Só dias com ao menos uma jornada, do mais recente para o mais antigo. */
  dias: DiaJornadaDTO[];
  totalMinutos: number;
}

export interface SolicitarPontoEmAtrasoRequest {
  /** UUID do aparelho — idempotência da outbox, igual ao check-in. */
  idCliente: string;
  /** Dia do ponto, `YYYY-MM-DD` no fuso de operação. */
  data: string;
  /** `HH:mm`. */
  horaInicio: string;
  /** `HH:mm`. */
  horaFim: string;
  justificativa: string;
}

export interface SolicitacaoPontoDTO {
  id: number;
  usuarioId: number;
  /** A fila do gestor lista pessoas, não ids. */
  usuarioNome: string;
  data: string;
  inicio: string;
  fim: string;
  minutosSolicitados: number;
  justificativa: string;
  status: StatusSolicitacaoPonto;
  /** Jornada que a aprovação criou ou completou. `null` enquanto pendente ou se rejeitada. */
  jornadaId: number | null;
  analisadoPor: number | null;
  analisadoEm: string | null;
  motivoRejeicao: string | null;
  criadoEm: string;
}

export interface RejeitarPontoRequest {
  motivo: string;
}

export interface BipagemRequest {
  codigoBarras: string;
  pedidoId: number;
  registradoEm: string;
}

export interface BipagemResponse {
  consistente: boolean;
  peca?: PecaDTO;
  motivo?: string;
}

export interface PecaDTO {
  id: number;
  codigoBarras: string;
  descricao: string;
  status: StatusPeca;
  ambienteId: number;
}

export interface PedidoDTO {
  id: number;
  numeroPedido: string;
  status: StatusPedido;
  clienteId: number;
}

export interface AvariaDTO {
  id: number;
  pecaId: number;
  tipoAvariaId: number;
  descricao: string;
  status: StatusAvaria;
}

export interface AtestadoDTO {
  id: number;
  usuarioId: number;
  dataInicio: string;
  dataFim: string;
  status: StatusAtestado;
  motivoRejeicao?: string | null;
}

export interface BancoHorasDTO {
  id: number;
  usuarioId: number;
  mes: number;
  ano: number;
  horasTrabalhadas: number;
  horasPrevistas: number;
  saldo: number;
}

/** Protocolo de sincronização (WatermelonDB pull/push). */
export interface SyncPullResponse {
  changes: Record<string, { created: unknown[]; updated: unknown[]; deleted: string[] }>;
  timestamp: number;
}

export interface SyncPushRequest {
  changes: Record<string, { created: unknown[]; updated: unknown[]; deleted: string[] }>;
  lastPulledAt: number | null;
}
