import { IsString, MaxLength, MinLength } from 'class-validator';
import type { AssociarCodigoBarrasRequest } from '@montacontrol/shared';

export class AssociarCodigoBarrasDto implements AssociarCodigoBarrasRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  codigoBarras!: string;
}
