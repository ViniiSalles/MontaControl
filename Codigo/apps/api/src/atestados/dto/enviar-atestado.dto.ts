import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { EnviarAtestadoRequest } from '@montacontrol/shared';
import { FotoBase64Dto } from '../../common/dto/foto-base64.dto';

export class EnviarAtestadoDto implements EnviarAtestadoRequest {
  @IsUUID()
  idCliente!: string;

  @IsISO8601({ strict: true })
  dataInicio!: string;

  @IsISO8601({ strict: true })
  dataFim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => FotoBase64Dto)
  fotos!: FotoBase64Dto[];
}
