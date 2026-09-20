import { IsBoolean } from 'class-validator';
import type { AlterarAtivoRequest } from '@montacontrol/shared';

export class AlterarAtivoDto implements AlterarAtivoRequest {
  @IsBoolean()
  ativo!: boolean;
}
