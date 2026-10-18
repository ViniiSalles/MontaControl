import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { BancoHoras } from '../db/BancoHoras';

/** Colunas que mudam in-place num `synchronize()` (o saldo do mês é recalculado no servidor). */
export const COLUNAS_OBSERVADAS_DE_BANCO_HORAS = [
  'horas_trabalhadas',
  'horas_previstas',
  'saldo',
];

export function queryBancoHoras(database: Database, mes: number, ano: number): Query<BancoHoras> {
  return database.get<BancoHoras>('banco_horas').query(Q.where('mes', mes), Q.where('ano', ano));
}

/**
 * Linha da réplica → DTO. O id local é o do servidor; `usuarioId` não existe na
 * réplica (a linha é sempre do montador logado) e fica no sentinela `-1`.
 */
export function paraBancoHorasDTO(registro: BancoHoras): BancoHorasDTO {
  return {
    id: Number(registro.id),
    usuarioId: -1,
    mes: registro.mes,
    ano: registro.ano,
    horasTrabalhadas: registro.horasTrabalhadas,
    horasPrevistas: registro.horasPrevistas,
    saldo: registro.saldo,
  };
}
