import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { AtualizarUsuarioRequest } from '@montacontrol/shared';

export class AtualizarUsuarioDto implements AtualizarUsuarioRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  // `null` limpa o telefone; ausente mantém o atual.
  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @IsString()
  @MaxLength(20)
  telefone?: string | null;
}
