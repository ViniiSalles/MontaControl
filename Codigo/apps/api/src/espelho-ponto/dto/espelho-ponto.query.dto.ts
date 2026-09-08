import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

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

  /**
   * Por padrão, um montador inativo (soft delete) não aparece. `@Type(() =>
   * Boolean)` trataria a string "false" como truthy — por isso a conversão
   * explícita aqui.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  incluirInativo?: boolean;
}
