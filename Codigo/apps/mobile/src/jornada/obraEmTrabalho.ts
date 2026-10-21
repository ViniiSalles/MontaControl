import { estadoJornada } from '@montacontrol/shared';
import type { ObraDoPonto } from '../pedidos/obras';
import type { JornadaExibida } from './jornadasComPendentes';

/** Por que não há obra em trabalho — a tela usa para explicar o bloqueio. */
export type MotivoSemObra =
  'sem_ponto' | 'jornada_vencida' | 'sem_obra_vinculada' | 'obra_fora_da_replica';

export type ObraEmTrabalho =
  { obra: ObraDoPonto; motivo: null } | { obra: null; motivo: MotivoSemObra };

/**
 * A obra em que o montador está presente: a do ponto de entrada em andamento.
 * É ela que Bipagem e Avarias herdam — escolher pedido nessas telas permitia
 * conferir peças ou abrir avaria numa obra onde ele não estava. Entrada além
 * do limite de 24h (`vencida`) não conta como presença.
 */
export function obraEmTrabalho(
  jornada: JornadaExibida | null,
  obras: readonly ObraDoPonto[],
  agoraIso: string,
): ObraEmTrabalho {
  if (!jornada) return { obra: null, motivo: 'sem_ponto' };
  const estado = estadoJornada(jornada, agoraIso);
  if (estado === 'finalizada') return { obra: null, motivo: 'sem_ponto' };
  if (estado === 'vencida') return { obra: null, motivo: 'jornada_vencida' };
  if (jornada.pedidoId === null) return { obra: null, motivo: 'sem_obra_vinculada' };
  const obra = obras.find((candidata) => candidata.id === jornada.pedidoId);
  return obra ? { obra, motivo: null } : { obra: null, motivo: 'obra_fora_da_replica' };
}
