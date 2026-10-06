import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { Perfil, StatusAvaria } from '../../../generated/prisma';

export class ListarAvariasQueryDto {
  @IsOptional()
  @IsEnum(StatusAvaria)
  status?: StatusAvaria;

  /** Quem reportou: operador do depósito ou montador. */
  @IsOptional()
  @IsIn([Perfil.DEPOSITO, Perfil.MONTADOR])
  origem?: Perfil;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  tipoAvariaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pedidoId?: number;
}
