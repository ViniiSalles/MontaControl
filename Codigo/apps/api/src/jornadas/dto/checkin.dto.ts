import { IsISO8601, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { CheckinRequest } from '@montacontrol/shared';

export class CheckinDto implements CheckinRequest {
  @IsUUID()
  idCliente!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsISO8601({ strict: true })
  registradoEm!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  endereco?: string;
}
