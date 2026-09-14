import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CompetenciaQueryDto } from '../../banco-horas/dto/competencia.query.dto';

export class EspelhoPontoQueryDto extends CompetenciaQueryDto {
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
