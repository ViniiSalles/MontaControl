import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FotoBase64Dto } from '../../common/dto/foto-base64.dto';
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

  @IsOptional()
  @ValidateNested()
  @Type(() => FotoBase64Dto)
  foto?: FotoBase64Dto;
}
