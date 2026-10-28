import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

export const LIMITE_PADRAO_NOTIFICACOES = 20;
export const LIMITE_MAXIMO_NOTIFICACOES = 50;

/** Teto do `int4` do Postgres: cursor acima disso viraria erro 500 na query. */
const MAIOR_ID = 2_147_483_647;

export class ListarNotificacoesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO_NOTIFICACOES)
  limite: number = LIMITE_PADRAO_NOTIFICACOES;

  /** Cursor: id da última notificação da página anterior (lista as mais antigas que ela). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(MAIOR_ID)
  antesDe?: number;
}
