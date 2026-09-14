import { useCallback, useEffect, useState } from 'react';
import type { DiaJornadaDTO, PeriodoHistorico } from '@montacontrol/shared';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { construirHistoricoDTO, janelaDoPeriodo, queryJornadasNoPeriodo } from './espelhoJornada';
import { puxarJornadas } from '../sincronizacao/syncManager';

export interface EstadoHistorico {
  dias: DiaJornadaDTO[];
  totalMinutos: number;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Histórico de pontos do período escolhido, lido do espelho local. Recarrega ao trocar de período. */
export function useHistoricoPontos(token: string, periodo: PeriodoHistorico): EstadoHistorico {
  const database = useDatabaseOuFalha();
  const [dias, setDias] = useState<DiaJornadaDTO[]>([]);
  const [totalMinutos, setTotalMinutos] = useState(0);
  const [carregandoLocal, setCarregandoLocal] = useState(true);
  const [falhaRede, setFalhaRede] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      await puxarJornadas(database, token, periodo);
      setFalhaRede(false);
    } catch {
      setFalhaRede(true);
    }
  }, [database, token, periodo]);

  useEffect(() => {
    const agoraIso = new Date().toISOString();
    const { inicioIso, fimIso } = janelaDoPeriodo(periodo, agoraIso);

    const assinatura = queryJornadasNoPeriodo(database, inicioIso, fimIso)
      .observe()
      .subscribe((registros) => {
        const historico = construirHistoricoDTO(registros, periodo, agoraIso);
        setDias(historico.dias);
        setTotalMinutos(historico.totalMinutos);
        setCarregandoLocal(false);
      });
    return () => assinatura.unsubscribe();
  }, [database, periodo]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { dias, totalMinutos, carregando: carregandoLocal, erro: falhaRede && dias.length === 0, recarregar };
}
