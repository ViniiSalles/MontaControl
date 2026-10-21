import { useDatabaseOuFalha } from '../db/useDatabase';
import type { ObraDoPonto } from '../pedidos/obras';
import { useObrasDoMontador } from '../pedidos/useObrasDoMontador';
import { obraEmTrabalho } from './obraEmTrabalho';
import type { MotivoSemObra } from './obraEmTrabalho';
import { useJornadaAtual } from './useJornadaAtual';

export interface EstadoObraEmTrabalho {
  obra: ObraDoPonto | null;
  /** `null` quando há obra. */
  motivo: MotivoSemObra | null;
  /** `true` até a primeira leitura da jornada e das obras. */
  carregando: boolean;
}

/**
 * Obra do ponto em andamento, lida só do banco local (réplica + fila): funciona
 * sem sinal. Calculada a cada render, sem memo — depende do relógio (limite de 24h).
 */
export function useObraEmTrabalho(): EstadoObraEmTrabalho {
  const database = useDatabaseOuFalha();
  const { jornada, carregando: carregandoJornada } = useJornadaAtual();
  const { obras, carregando: carregandoObras } = useObrasDoMontador(database);
  const { obra, motivo } = obraEmTrabalho(jornada, obras, new Date().toISOString());
  return { obra, motivo, carregando: carregandoJornada || carregandoObras };
}
