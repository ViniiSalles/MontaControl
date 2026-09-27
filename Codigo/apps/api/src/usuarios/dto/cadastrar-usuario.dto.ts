import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';
import { Perfil } from '../../../generated/prisma';

export class CadastrarUsuarioDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsEnum(Perfil)
  perfil!: Perfil;

  @IsOptional()
  @IsCpf()
  cpf?: string;
}
