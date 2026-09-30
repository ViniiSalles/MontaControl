import {
  Perfil,
  StatusAmbiente,
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
  /** Ausente nas respostas de `/auth` (login/me) — só a listagem de usuários projeta telefone. */
  telefone?: string | null;
  perfil: Perfil;
  ativo: boolean;
  /** 11 dígitos. Só a listagem de usuários (RH/Gestor) projeta; ausente nas respostas de `/auth`. */
  cpf?: string | null;
  /** Instante ISO do cadastro. Só a listagem projeta. */
  criadoEm?: string;
}

export interface CadastrarUsuarioRequest {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  perfil: Perfil;
  cpf?: string;
}

export interface InformarCpfRequest {
  cpf: string;
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

export interface ClienteResumoDTO {
  id: number;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
}

export interface ItemPedidoRequest {
  descricao: string;
  quantidade: number;
}

export interface AmbientePedidoRequest {
  nome: string;
  itens: ItemPedidoRequest[];
}

export interface CriarPedidoRequest {
  clienteId: number;
  ambientes: AmbientePedidoRequest[];
}

export interface ItemPedidoDTO {
  /** Id do grupo de peças do item (`Peca.itemId`) — chave do card na tela. */
  itemId: number;
  ambienteId: number;
  descricao: string;
  quantidade: number;
  /** Peças do item já bipadas pelo depósito. */
  quantidadeTriada: number;
}

export interface AmbientePedidoDTO {
  id: number;
  nome: string;
  status: StatusAmbiente;
  itens: ItemPedidoDTO[];
}

export interface PedidoResumoDTO {
  id: number;
  numeroPedido: string;
  status: StatusPedido;
  clienteId: number;
  clienteNome: string;
  quantidadeTotal: number;
  quantidadeTriada: number;
}

export interface PedidoDetalheDTO extends PedidoResumoDTO {
  ambientes: AmbientePedidoDTO[];
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
  /** `null` enquanto a peça está PENDENTE — o código só existe depois da triagem. */
  codigoBarras: string | null;
  descricao: string;
  /** Unidades que o slot representa (ex.: caixa com 150 pregos) — bipadas de uma só vez. */
  quantidade: number;
  status: StatusPeca;
  ambienteId: number;
}

export interface PedidoDTO {
  id: number;
  numeroPedido: string;
  status: StatusPedido;
  clienteId: number;
}

/** US07/UC09/UC10 — Operador Logístico lê o código de barras e confirma pedido + ambiente. */
export interface TriarPecaRequest {
  codigoBarras: string;
  descricao: string;
  numeroPedido: string;
  ambiente: string;
}

/** Operador associa o código de barras lido a uma peça PENDENTE já cadastrada pelo gestor. */
export interface AssociarCodigoBarrasRequest {
  codigoBarras: string;
}

export interface AmbienteComPecasDTO {
  id: number;
  nome: string;
  status: StatusAmbiente;
  pecas: PecaDTO[];
}

/** N7T3 — peças do pedido organizadas por ambiente, para conferência antes do despacho. */
export interface PedidoComAmbientesDTO extends PedidoDTO {
  ambientes: AmbienteComPecasDTO[];
}

export interface AvariaDTO {
  id: number;
  pecaId: number;
  tipoAvariaId: number;
  descricao: string;
  status: StatusAvaria;
}

export interface FotoBase64 {
  /** Conteúdo do arquivo em base64, sem o prefixo `data:`. */
  conteudoBase64: string;
  mimeType: 'image/jpeg' | 'image/png';
}

export interface EnviarAtestadoRequest {
  /** UUID do aparelho — idempotência da outbox, igual ao check-in. */
  idCliente: string;
  /** `YYYY-MM-DD` no fuso de operação. */
  dataInicio: string;
  /** `YYYY-MM-DD`, inclusivo. */
  dataFim: string;
  /** Texto livre do montador (até 500 caracteres); opcional. */
  observacao?: string;
  /** Ao menos uma foto; o atestado sem documento não é analisável. */
  fotos: FotoBase64[];
}

export interface AtestadoDTO {
  id: number;
  usuarioId: number;
  /** A fila do RH lista pessoas, não ids. */
  usuarioNome: string;
  dataInicio: string;
  dataFim: string;
  observacao: string | null;
  status: StatusAtestado;
  motivoRejeicao: string | null;
  validadoPor: number | null;
  validadoEm: string | null;
  criadoEm: string;
}

export interface AtestadoFotoDTO {
  id: number;
  /** URL assinada com expiração — o caminho cru do bucket nunca sai da API (LGPD). */
  url: string;
  /** Instante ISO em que a URL deixa de valer. */
  expiraEm: string;
}

export interface AtestadoDetalhadoDTO extends AtestadoDTO {
  fotos: AtestadoFotoDTO[];
}

export interface RejeitarAtestadoRequest {
  motivo: string;
}

export interface AlterarAtivoRequest {
  ativo: boolean;
}

/** Linha do painel de banco de horas do RH. Horas decimais, como a coluna `Decimal(7,2)`. */
export interface SaldoMontadorDTO extends BancoHorasDTO {
  usuarioNome: string;
  /** Horas descontadas da previsão por atestado validado no mês. */
  horasAbonadas: number;
  /** Quantas solicitações de ponto em atraso do montador aguardam análise. */
  compensacoesPendentes: number;
}

export interface TurnoEspelhoDTO {
  inicio: string | null;
  fim: string | null;
  minutosTrabalhados: number;
  lancadoEmAtraso: boolean;
}

export interface DiaEspelhoDTO {
  /** `YYYY-MM-DD` no fuso de operação. */
  data: string;
  inicio: string | null;
  fim: string | null;
  minutosTrabalhados: number;
  emAndamento: boolean;
  /** Alguma jornada do dia nasceu de ponto em atraso aprovado. */
  lancadoEmAtraso: boolean;
  /** Justificativa da solicitação aprovada — mesmo texto da fila de compensações. `null` fora de `lancadoEmAtraso`. */
  justificativaLancamento: string | null;
  /** Coberto por atestado validado. */
  abonado: boolean;
  diaUtil: boolean;
  /** Um turno por jornada do dia, em ordem cronológica. Vazio nos dias sem marcação. */
  turnos: TurnoEspelhoDTO[];
}

export interface EspelhoPontoDTO {
  usuarioId: number;
  usuarioNome: string;
  mes: number;
  ano: number;
  /** Todos os dias do mês, do 1º ao último — inclusive os sem marcação. */
  dias: DiaEspelhoDTO[];
  minutosTrabalhados: number;
  minutosPrevistos: number;
  minutosAbonados: number;
  /** `minutosTrabalhados + minutosAbonados - minutosPrevistos`. Negativo = devendo. */
  saldoMinutos: number;
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
