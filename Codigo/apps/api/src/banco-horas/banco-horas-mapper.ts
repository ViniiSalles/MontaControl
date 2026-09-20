import { Prisma } from '../../generated/prisma';
import type { BancoHorasDTO } from '@montacontrol/shared';

/** Seleção mínima que o `BancoHorasDTO` exige. */
export const SELECAO_BANCO_HORAS = {
  id: true,
  usuarioId: true,
  mes: true,
  ano: true,
  horasTrabalhadas: true,
  horasPrevistas: true,
  saldo: true,
} as const;

type LinhaBancoHoras = Prisma.BancoHorasGetPayload<{ select: typeof SELECAO_BANCO_HORAS }>;

/** `Decimal` do Prisma não é serializável em JSON como número — mesma conversão de `jornada-mapper.ts`. */
export function paraBancoHorasDTO(linha: LinhaBancoHoras): BancoHorasDTO {
  return {
    id: linha.id,
    usuarioId: linha.usuarioId,
    mes: linha.mes,
    ano: linha.ano,
    horasTrabalhadas: linha.horasTrabalhadas.toNumber(),
    horasPrevistas: linha.horasPrevistas.toNumber(),
    saldo: linha.saldo.toNumber(),
  };
}
