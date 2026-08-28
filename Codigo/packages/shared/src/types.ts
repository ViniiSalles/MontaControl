import {
  Perfil,
  StatusAtestado,
  StatusAvaria,
  StatusJornada,
  StatusPeca,
  StatusPedido,
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

export interface CheckinRequest {
  latitude: number;
  longitude: number;
  /** Timestamp do dispositivo — relevante em operação offline-first. */
  registradoEm: string;
}

export interface JornadaDTO {
  id: number;
  usuarioId: number;
  status: StatusJornada;
  checkinAt: string | null;
  checkoutAt: string | null;
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
