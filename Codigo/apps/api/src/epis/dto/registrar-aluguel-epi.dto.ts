import { IsInt, IsISO8601, IsOptional, IsPositive, IsString, Max, MaxLength } from 'class-validator';
import type { RegistrarAluguelEpiRequest } from '@montacontrol/shared';

export class RegistrarAluguelEpiDto implements RegistrarAluguelEpiRequest {
  @IsInt()
  @IsPositive()
  tipoEpiId!: number;

  @IsInt()
  @IsPositive()
  usuarioId!: number;

  @IsInt()
  @IsPositive()
  @Max(1_000)
  quantidade!: number;

  @IsISO8601({ strict: true })
  inicio!: string;

  @IsISO8601({ strict: true })
  fimPrevisto!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
