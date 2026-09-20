import { IsString, MaxLength, MinLength } from 'class-validator';
import type { RejeitarPontoRequest } from '@montacontrol/shared';

export class RejeitarPontoDto implements RejeitarPontoRequest {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;
}
