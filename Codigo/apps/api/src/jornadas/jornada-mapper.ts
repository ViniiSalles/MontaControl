import { Prisma } from '../../generated/prisma';
import type { JornadaDTO, StatusJornada as StatusJornadaCompartilhado } from '@montacontrol/shared';

/** Seleção mínima que o `JornadaDTO` exige. */
export const SELECAO_JORNADA = {
  id: true,
  usuarioId: true,
  status: true,
  checkinAt: true,
  checkinLatitude: true,
  checkinLongitude: true,
  checkinEndereco: true,
  checkoutAt: true,
  checkoutLatitude: true,
  checkoutLongitude: true,
  checkoutEndereco: true,
  createdAt: true,
  // Só a existência interessa — `lancadoEmAtraso` é booleano. A relação é
  // 1-1 (`jornada_id` é único em `solicitacao_ponto`), então não há lista
  // para contar.
  solicitacaoPonto: { select: { id: true } },
} as const;

type LinhaJornada = Prisma.JornadaGetPayload<{ select: typeof SELECAO_JORNADA }>;

function numero(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : valor.toNumber();
}

/**
 * `Decimal` do Prisma não é serializável em JSON como número, e `Date` sai
 * como ISO só por acidente do `JSON.stringify`. Converter aqui deixa o
 * contrato de fio explícito em vez de depender do serializador.
 */
export function paraJornadaDTO(linha: LinhaJornada): JornadaDTO {
  return {
    id: linha.id,
    usuarioId: linha.usuarioId,
    // `StatusJornada` existe tanto no client do Prisma quanto no pacote
    // compartilhado (mesmos valores, guardado por contrato-enums.spec.ts) —
    // são tipos nominalmente distintos, daí o cast.
    status: linha.status as unknown as StatusJornadaCompartilhado,
    checkinAt: linha.checkinAt?.toISOString() ?? null,
    checkinLatitude: numero(linha.checkinLatitude),
    checkinLongitude: numero(linha.checkinLongitude),
    checkinEndereco: linha.checkinEndereco,
    checkoutAt: linha.checkoutAt?.toISOString() ?? null,
    checkoutLatitude: numero(linha.checkoutLatitude),
    checkoutLongitude: numero(linha.checkoutLongitude),
    checkoutEndereco: linha.checkoutEndereco,
    lancadoEmAtraso: linha.solicitacaoPonto !== null,
    criadoEm: linha.createdAt.toISOString(),
  };
}
