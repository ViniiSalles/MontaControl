import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/** Espelho local de `BancoHorasDTO`, chave composta (mes, ano) — issue #18. */
export class BancoHoras extends Model {
  static table = 'banco_horas';

  @field('mes') mes!: number;
  @field('ano') ano!: number;
  @field('horas_trabalhadas') horasTrabalhadas!: number;
  @field('horas_previstas') horasPrevistas!: number;
  @field('saldo') saldo!: number;
}
