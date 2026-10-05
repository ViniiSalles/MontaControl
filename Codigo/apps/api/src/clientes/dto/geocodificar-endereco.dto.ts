import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UFS, type GeocodificarEnderecoRequest } from '@montacontrol/shared';

export class GeocodificarEnderecoDto implements GeocodificarEnderecoRequest {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  endereco!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  cidade!: string;

  @IsIn(UFS)
  estado!: string;

  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'cep deve ter 8 dígitos' })
  cep?: string;
}
