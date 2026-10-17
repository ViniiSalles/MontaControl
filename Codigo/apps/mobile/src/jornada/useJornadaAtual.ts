import { useCallback, useEffect, useState } from 'react';
import type { JornadaDTO } from '@montacontrol/shared';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { paraJornadaDTO, queryJornadaAtual } from './espelhoJornada';
import { puxarJornadas } from '../sincronizacao/syncManager';

export interface EstadoJornadaAtual {
  jornada: JornadaDTO | null;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Jornada aberta do montador, lida do espelho local — atualiza sozinha quando o espelho muda. */
export function useJornadaAtual(): EstadoJornadaAtual {
  const database = useDatabaseOuFalha();
  const [jornada, setJornada] = useState<JornadaDTO | null>(null);
  const [carregandoLocal, setCarregandoLocal] = useState(true);
  const [falhaRede, setFalhaRede] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      await puxarJornadas(database);
      setFalhaRede(false);
    } catch {
      setFalhaRede(true);
    }
  }, [database]);

  useEffect(() => {
    const assinatura = queryJornadaAtual(database)
      .observe()
      .subscribe((registros) => {
        setJornada(registros.length > 0 ? paraJornadaDTO(registros[0]) : null);
        setCarregandoLocal(false);
      });
    return () => assinatura.unsubscribe();
  }, [database]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { jornada, carregando: carregandoLocal, erro: falhaRede && jornada === null, recarregar };
}
