import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBase64,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type { EnviarAtestadoRequest, FotoBase64 } from '@montacontrol/shared';

export class FotoBase64Dto implements FotoBase64 {
  @IsBase64()
  conteudoBase64!: string;

  @IsIn(['image/jpeg', 'image/png'])
  mimeType!: 'image/jpeg' | 'image/png';
}

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
