import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { SyncPullQuery } from '@montacontrol/shared';

/** Maior instante que `Date` aceita (ms); acima disso a conversão vira `Invalid Date`. */
const MAXIMO_INSTANTE_MS = 8_640_000_000_000_000;

/** Query string chega como texto; vazio vira ausente (o `Number('')` seria 0). */
function paraNumero({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class SyncPullQueryDto implements SyncPullQuery {
  /** `timestamp` do pull anterior; ausente no primeiro pull. */
  @IsOptional()
  @Transform(paraNumero)
  @IsInt()
  @Min(0)
  @Max(MAXIMO_INSTANTE_MS)
  lastPulledAt?: number;

  @Transform(paraNumero)
  @IsInt()
  schemaVersion!: number;
}
