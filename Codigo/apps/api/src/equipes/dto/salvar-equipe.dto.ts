import { ArrayMaxSize, IsArray, IsInt, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import type { SalvarEquipeRequest } from '@montacontrol/shared';

export class SalvarEquipeDto implements SalvarEquipeRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  membrosIds!: number[];
}
