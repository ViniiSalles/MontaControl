import { agruparJornadasPorDia, comporInstante, diaNoFuso, somarDias } from '@montacontrol/shared';
import type { HistoricoJornadasDTO, JornadaDTO, PeriodoHistorico } from '@montacontrol/shared';
import { FUSO_OPERACAO } from '../config/fuso';

/** Mesma janela usada pelo backend em `jornadas.service.ts#historico`. */
export function janelaDoPeriodo(
  dias: PeriodoHistorico,
  agoraIso: string,
): { inicioPeriodo: string; fimPeriodo: string; inicioIso: string; fimIso: string } {
  const fimPeriodo = diaNoFuso(agoraIso, FUSO_OPERACAO);
  const inicioPeriodo = somarDias(fimPeriodo, -(dias - 1));
  const inicioIso = comporInstante(inicioPeriodo, '00:00', FUSO_OPERACAO);
  const fimIso = new Date(
    new Date(comporInstante(somarDias(fimPeriodo, 1), '00:00', FUSO_OPERACAO)).getTime() - 1,
  ).toISOString();
  return { inicioPeriodo, fimPeriodo, inicioIso, fimIso };
}

/** Jornadas cujo check-in cai dentro do período (a janela de `janelaDoPeriodo`). */
export function jornadasNoPeriodo<T extends JornadaDTO>(
  jornadas: readonly T[],
  dias: PeriodoHistorico,
  agoraIso: string,
): T[] {
  const { inicioIso, fimIso } = janelaDoPeriodo(dias, agoraIso);
  return jornadas.filter(
    (jornada) =>
      jornada.checkinAt !== null && jornada.checkinAt >= inicioIso && jornada.checkinAt <= fimIso,
  );
}

export function construirHistoricoDTO(
  jornadas: readonly JornadaDTO[],
  dias: PeriodoHistorico,
  agoraIso: string,
): HistoricoJornadasDTO {
  const { inicioPeriodo, fimPeriodo } = janelaDoPeriodo(dias, agoraIso);
  const diasAgrupados = agruparJornadasPorDia([...jornadas], FUSO_OPERACAO);
  return {
    periodoDias: dias,
    inicioPeriodo,
    fimPeriodo,
    dias: diasAgrupados,
    totalMinutos: diasAgrupados.reduce((soma, dia) => soma + dia.minutosTrabalhados, 0),
  };
}
