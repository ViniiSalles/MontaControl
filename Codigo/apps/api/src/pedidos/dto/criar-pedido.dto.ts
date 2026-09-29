import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CriarPedidoRequest } from '@montacontrol/shared';

export class ItemPedidoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descricao!: string;

  @IsInt()
  @Min(1)
  quantidade!: number;
}

export class AmbientePedidoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens!: ItemPedidoDto[];
}

export class CriarPedidoDto implements CriarPedidoRequest {
  @IsInt()
  @Min(1)
  clienteId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AmbientePedidoDto)
  ambientes!: AmbientePedidoDto[];
}
