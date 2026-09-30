import { IsEnum, IsOptional } from 'class-validator';
import { StatusPedido } from '../../../generated/prisma';

export class ListarPedidosQueryDto {
  @IsOptional()
  @IsEnum(StatusPedido)
  status?: StatusPedido;
}
