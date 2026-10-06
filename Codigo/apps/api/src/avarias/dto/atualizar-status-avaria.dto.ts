import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatusAvaria } from '../../../generated/prisma';

export class AtualizarStatusAvariaDto {
  @IsEnum(StatusAvaria)
  status!: StatusAvaria;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  parecer?: string;
}
