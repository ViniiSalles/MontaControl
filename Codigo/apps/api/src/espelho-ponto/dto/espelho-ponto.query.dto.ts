import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Query string chega como texto; `@Type` converte antes das validações numéricas. */
export class EspelhoPontoQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuarioId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  ano!: number;
}
