import type { PeriodoHistorico } from '../types';

// Janelas do primeiro pull (sem `lastPulledAt`): quanto histórico a réplica
// local do montador carrega. O backend filtra por elas e o mobile as usa para
// saber até onde o histórico offline vai. Pedidos, ambientes e peças (todos os
// atribuídos) e tipos de avaria (catálogo inteiro) não têm janela.

/** Dias de jornadas, contados por `checkin_at`: o maior `PeriodoHistorico` do seletor de histórico. */
export const SYNC_JANELA_JORNADAS_DIAS = 30 satisfies PeriodoHistorico;

/** Meses de banco de horas por (`mes`, `ano`) no fuso de operação (`jornadas/fuso`): o mês atual e os 2 anteriores. */
export const SYNC_JANELA_BANCO_HORAS_MESES = 3;

/** Dias de avarias registradas pelo montador, contados por `criado_em`. */
export const SYNC_JANELA_AVARIAS_DIAS = 30;

/** Dias de atestados do montador, contados por `criado_em`. */
export const SYNC_JANELA_ATESTADOS_DIAS = 90;

/** Dias de notificações do montador, contados por `criada_em`. */
export const SYNC_JANELA_NOTIFICACOES_DIAS = 30;
