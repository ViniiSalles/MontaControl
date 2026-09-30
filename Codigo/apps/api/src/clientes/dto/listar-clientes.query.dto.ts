import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListarClientesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;
}
