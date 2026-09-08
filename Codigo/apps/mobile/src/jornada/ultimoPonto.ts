import { estadoJornada, minutosDaJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO, EstadoJornada, JornadaDTO } from '@montacontrol/shared';

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

/**
 * Minutos trabalhados hoje, somando **todos** os turnos do dia — não só o
 * que a tela está exibindo agora. `diaHoje` vem do histórico
 * (`agruparJornadasPorDia`, que já sabe somar vários turnos por dia); esta
 * função só troca a contribuição do turno atual pela versão que a tela já
 * tem em mãos (`jornadaExibida`), mais fresca que o histórico pode estar.
 *
 * Sem essa troca por id, reabrir um turno no mesmo dia "esquecia" o(s)
 * turno(s) anteriores: a tela só olhava para o turno aberto agora, e a soma
 * voltava a zero a cada nova entrada — bug reportado depois do primeiro
 * refactor da tela.
 *
 * `null` sem nenhum turno hoje, ou com a jornada exibida vencida — aí o
 * check-in é de mais de 24h atrás e a duração bruta não significa "tempo
 * trabalhado hoje", é só ruído.
 */
export function minutosTrabalhadosHoje(
  diaHoje: DiaJornadaDTO | null,
  jornadaExibida: JornadaDTO | null,
  estado: EstadoJornada,
  agoraIso: string,
): number | null {
  if (estado === 'vencida') return null;
  if (!diaHoje && !jornadaExibida) return null;

  const outrosTurnos = (diaHoje?.jornadas ?? []).filter((j) => j.id !== jornadaExibida?.id);
  const minutosOutros = outrosTurnos.reduce((soma, j) => soma + minutosDaJornada(j), 0);

  if (!jornadaExibida?.checkinAt) return minutosOutros;

  const minutosAtual = jornadaExibida.checkoutAt
    ? minutosDaJornada(jornadaExibida)
    : Math.max(
        0,
        Math.round(
          (new Date(agoraIso).getTime() - new Date(jornadaExibida.checkinAt).getTime()) / 60_000,
        ),
      );

  return minutosOutros + minutosAtual;
}
