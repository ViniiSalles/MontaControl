import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { SalvarTipoEpiRequest } from '@montacontrol/shared';

export class SalvarTipoEpiDto implements SalvarTipoEpiRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome!: string;

  @IsString()
  @MaxLength(300)
  descricao!: string;

  @IsInt()
  @Min(1)
  @Max(120)
  validadeMeses!: number;

  @IsInt()
  @Min(0)
  @Max(10_000)
  estoque!: number;
}
