import { estadoJornada } from '@montacontrol/shared';
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
 * Qual ponto o botão vai bater. Só turno vivo pede saída: jornada aberta
 * que passou do limite é check-out esquecido, não turno em curso, e insistir
 * em oferecer a saída deixaria o montador sem começar o dia de hoje.
 *
 * Quem decide é `estadoJornada` (`@montacontrol/shared`), a mesma função que
 * a API usa para recusar o check-out — duas cópias da regra divergiriam.
 */
export function proximaAcao(jornada: JornadaDTO | null, agoraIso: string): TipoPonto {
  if (!jornada) return 'entrada';
  return estadoJornada(jornada, agoraIso) === 'em_andamento' ? 'saida' : 'entrada';
}

/** Rótulo em pt-BR para exibição — `'saida'` é o identificador, "saída" é o texto. */
export function rotuloPonto(tipo: TipoPonto): string {
  return tipo === 'saida' ? 'saída' : 'entrada';
}
