import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { ReportarAvariaRequest } from '@montacontrol/shared';
import { FotoBase64Dto } from '../../common/dto/foto-base64.dto';

export class ReportarAvariaDto implements ReportarAvariaRequest {
  @IsUUID()
  idCliente!: string;

  @IsInt()
  @IsPositive()
  pecaId!: number;

  @IsInt()
  @IsPositive()
  tipoAvariaId!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  descricao!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => FotoBase64Dto)
  fotos?: FotoBase64Dto[];
}
