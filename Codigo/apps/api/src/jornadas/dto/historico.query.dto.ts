import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';
import type { PeriodoHistorico } from '@montacontrol/shared';

const PERIODOS: PeriodoHistorico[] = [5, 15, 30];

export class HistoricoQueryDto {
  /** Query string chega como texto; `@Type` converte antes do `@IsIn`. */
  @Type(() => Number)
  @IsIn(PERIODOS)
  dias!: PeriodoHistorico;
}
