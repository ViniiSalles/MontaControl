import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { BancoHoras } from '../db/BancoHoras';

function preencherBancoHoras(registro: BancoHoras, dto: BancoHorasDTO): void {
  registro.mes = dto.mes;
  registro.ano = dto.ano;
  registro.horasTrabalhadas = dto.horasTrabalhadas;
  registro.horasPrevistas = dto.horasPrevistas;
  registro.saldo = dto.saldo;
}

/** Upsert por (mes, ano) — cada mês consultado (corrente ou navegado) é sua própria linha. */
export async function upsertBancoHoras(database: Database, dto: BancoHorasDTO): Promise<void> {
  const colecao = database.get<BancoHoras>('banco_horas');
  await database.write(async () => {
    const existentes = await colecao.query(Q.where('mes', dto.mes), Q.where('ano', dto.ano)).fetch();
    if (existentes.length > 0) {
      await existentes[0].update((registro) => preencherBancoHoras(registro, dto));
    } else {
      await colecao.create((registro) => preencherBancoHoras(registro, dto));
    }
  });
}

export function queryBancoHoras(database: Database, mes: number, ano: number): Query<BancoHoras> {
  return database.get<BancoHoras>('banco_horas').query(Q.where('mes', mes), Q.where('ano', ano));
}

export function paraBancoHorasDTO(registro: BancoHoras): BancoHorasDTO {
  return {
    id: -1,
    usuarioId: -1,
    mes: registro.mes,
    ano: registro.ano,
    horasTrabalhadas: registro.horasTrabalhadas,
    horasPrevistas: registro.horasPrevistas,
    saldo: registro.saldo,
  };
}
