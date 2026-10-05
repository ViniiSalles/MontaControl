import { IsIn, IsLatitude, IsLongitude, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UFS, type SalvarClienteRequest } from '@montacontrol/shared';

export class SalvarClienteDto implements SalvarClienteRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome!: string;

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

  @Matches(/^\d{5}-?\d{3}$/, { message: 'cep deve ter 8 dígitos' })
  cep!: string;

  @Matches(/^[\d\s()+-]{10,20}$/, { message: 'telefone inválido' })
  telefone!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
