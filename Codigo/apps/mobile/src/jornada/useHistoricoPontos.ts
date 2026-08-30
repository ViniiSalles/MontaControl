import { useCallback, useEffect, useState } from 'react';
import type { DiaJornadaDTO, PeriodoHistorico } from '@montacontrol/shared';
import { buscarHistorico } from './clienteJornadas';

export interface EstadoHistorico {
  dias: DiaJornadaDTO[];
  totalMinutos: number;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Histórico de pontos do período escolhido. Recarrega ao trocar de período. */
export function useHistoricoPontos(token: string, periodo: PeriodoHistorico): EstadoHistorico {
  const [dias, setDias] = useState<DiaJornadaDTO[]>([]);
  const [totalMinutos, setTotalMinutos] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const historico = await buscarHistorico(token, periodo);
      setDias(historico.dias);
      setTotalMinutos(historico.totalMinutos);
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [token, periodo]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { dias, totalMinutos, carregando, erro, recarregar };
}
