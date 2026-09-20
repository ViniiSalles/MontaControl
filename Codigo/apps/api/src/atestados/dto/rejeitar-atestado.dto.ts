import { IsString, MaxLength, MinLength } from 'class-validator';
import type { RejeitarAtestadoRequest } from '@montacontrol/shared';

export class RejeitarAtestadoDto implements RejeitarAtestadoRequest {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;
}
