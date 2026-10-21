import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type { ConferirPecaRequest } from '@montacontrol/shared';

export class ConferirPecaDto implements ConferirPecaRequest {
  @IsInt()
  @Min(1)
  pedidoId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  codigoBarras!: string;
}
