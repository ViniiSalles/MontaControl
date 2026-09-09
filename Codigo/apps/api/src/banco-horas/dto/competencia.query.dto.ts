import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Competência do banco de horas: `?ano=2026&mes=9`. */
export class CompetenciaQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  ano!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
