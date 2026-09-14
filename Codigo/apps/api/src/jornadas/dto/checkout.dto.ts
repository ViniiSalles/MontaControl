import {
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { CheckoutRequest } from '@montacontrol/shared';

export class CheckoutDto implements CheckoutRequest {
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

  @IsOptional()
  @IsInt()
  @IsPositive()
  pedidoId?: number;
}
