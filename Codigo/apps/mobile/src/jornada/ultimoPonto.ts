import type { JornadaDTO } from '@montacontrol/shared';

/** Os dois registros que uma jornada guarda. */
export type TipoPonto = 'entrada' | 'saida';

/**
 * Recorte plano do último registro batido, sem o resto da jornada. A tela
 * mostra sempre os mesmos campos, mudando só de qual metade do `JornadaDTO`
 * eles vêm — achatar aqui evita espalhar `ponto === 'saida' ? checkout... :
 * checkin...` por dentro do JSX.
 */
export interface UltimoPonto {
  tipo: TipoPonto;
  /** ISO 8601 do instante registrado. */
  registradoEm: string;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  /** Ponto criado por aprovação de atraso — nunca tem coordenada. */
  lancadoEmAtraso: boolean;
}

/** Último ponto da jornada, ou `null` quando ainda não há nenhum. */
export function derivarUltimoPonto(jornada: JornadaDTO | null): UltimoPonto | null {
  if (!jornada) return null;

  if (jornada.checkoutAt) {
    return {
      tipo: 'saida',
      registradoEm: jornada.checkoutAt,
      latitude: jornada.checkoutLatitude,
      longitude: jornada.checkoutLongitude,
      endereco: jornada.checkoutEndereco,
      lancadoEmAtraso: jornada.lancadoEmAtraso,
    };
  }

  if (jornada.checkinAt) {
    return {
      tipo: 'entrada',
      registradoEm: jornada.checkinAt,
      latitude: jornada.checkinLatitude,
      longitude: jornada.checkinLongitude,
      endereco: jornada.checkinEndereco,
      lancadoEmAtraso: jornada.lancadoEmAtraso,
    };
  }

  return null;
}

/**
 * Qual ponto o botão vai bater. A decisão olha `checkoutAt`, não `status`:
 * `EM_ANDAMENTO` e `PAUSADA` são ambos jornada aberta, e o que impede um
 * segundo check-in é justamente a saída ainda não registrada.
 */
export function proximaAcao(jornada: JornadaDTO | null): TipoPonto {
  return jornada && jornada.checkoutAt === null ? 'saida' : 'entrada';
}

/** Rótulo em pt-BR para exibição — `'saida'` é o identificador, "saída" é o texto. */
export function rotuloPonto(tipo: TipoPonto): string {
  return tipo === 'saida' ? 'saída' : 'entrada';
}
