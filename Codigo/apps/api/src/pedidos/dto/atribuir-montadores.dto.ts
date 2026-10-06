import { ArrayMaxSize, IsArray, IsInt, IsPositive } from 'class-validator';
import type { AtribuirMontadoresRequest } from '@montacontrol/shared';

export class AtribuirMontadoresDto implements AtribuirMontadoresRequest {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  usuarioIds!: number[];
}
