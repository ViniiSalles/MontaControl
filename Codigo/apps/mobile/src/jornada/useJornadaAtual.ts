import { useCallback, useEffect, useState } from 'react';
import type { JornadaDTO } from '@montacontrol/shared';
import { buscarJornadaAtual } from './clienteJornadas';

export interface EstadoJornadaAtual {
  jornada: JornadaDTO | null;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Jornada aberta do montador, ou `null` quando não há nenhuma. */
export function useJornadaAtual(token: string): EstadoJornadaAtual {
  const [jornada, setJornada] = useState<JornadaDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setJornada(await buscarJornadaAtual(token));
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { jornada, carregando, erro, recarregar };
}
