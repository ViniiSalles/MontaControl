import { IsString, MaxLength, MinLength } from 'class-validator';
import type { TriarPecaRequest } from '@montacontrol/shared';

export class TriarPecaDto implements TriarPecaRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  codigoBarras!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  descricao!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  numeroPedido!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  ambiente!: string;
}
