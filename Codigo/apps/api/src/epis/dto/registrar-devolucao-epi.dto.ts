import { IsISO8601, IsOptional } from 'class-validator';
import type { RegistrarDevolucaoEpiRequest } from '@montacontrol/shared';

export class RegistrarDevolucaoEpiDto implements RegistrarDevolucaoEpiRequest {
  /** Omitido = agora. */
  @IsOptional()
  @IsISO8601({ strict: true })
  devolvidoEm?: string;
}
