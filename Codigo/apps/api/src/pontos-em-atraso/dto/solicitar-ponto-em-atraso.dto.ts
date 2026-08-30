import { IsString, IsUUID, Length, Matches } from 'class-validator';
import type { SolicitarPontoEmAtrasoRequest } from '@montacontrol/shared';

/** `YYYY-MM-DD`. O dia civil no fuso de operação, não um instante. */
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** `HH:mm` em relógio de 24h — `24:00` e `9:5` ficam de fora. */
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Sem isto o gestor recebe "esqueci" e não tem como decidir. */
const MINIMO_JUSTIFICATIVA = 10;
const MAXIMO_JUSTIFICATIVA = 500;

export class SolicitarPontoEmAtrasoDto implements SolicitarPontoEmAtrasoRequest {
  @IsUUID()
  idCliente!: string;

  @Matches(FORMATO_DATA, { message: 'data deve estar no formato YYYY-MM-DD' })
  data!: string;

  @Matches(FORMATO_HORA, { message: 'horaInicio deve estar no formato HH:mm' })
  horaInicio!: string;

  @Matches(FORMATO_HORA, { message: 'horaFim deve estar no formato HH:mm' })
  horaFim!: string;

  @IsString()
  @Length(MINIMO_JUSTIFICATIVA, MAXIMO_JUSTIFICATIVA)
  justificativa!: string;
}
