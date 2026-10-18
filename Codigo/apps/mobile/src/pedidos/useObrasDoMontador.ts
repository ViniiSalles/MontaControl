import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@nozbe/watermelondb';
import { sincronizar } from '../sincronizacao/syncManager';
import { COLUNAS_OBSERVADAS_DE_PEDIDO, paraObraDoPonto, queryPedidos } from './obras';
import type { ObraDoPonto } from './obras';

export interface EstadoObras {
  obras: ObraDoPonto[];
  /** `true` até a primeira leitura do banco local. */
  carregando: boolean;
  /** Dispara uma sincronização e espera ela terminar. */
  recarregar: () => Promise<void>;
}

/**
 * Obras em que o montador pode bater ponto: a tabela `pedidos` da réplica. É
 * ela que faz o ponto funcionar sem sinal (a obra e o raio dela já estão no
 * aparelho); pedido desalocado no servidor sai daqui no pull seguinte.
 */
export function useObrasDoMontador(database: Database): EstadoObras {
  const [obras, setObras] = useState<ObraDoPonto[] | null>(null);

  useEffect(() => {
    const assinatura = queryPedidos(database)
      .observeWithColumns(COLUNAS_OBSERVADAS_DE_PEDIDO)
      .subscribe((pedidos) =>
        setObras(
          pedidos
            .map(paraObraDoPonto)
            .sort((a, b) => a.numeroPedido.localeCompare(b.numeroPedido)),
        ),
      );
    return () => assinatura.unsubscribe();
  }, [database]);

  const recarregar = useCallback(() => sincronizar(database), [database]);

  return { obras: obras ?? [], carregando: obras === null, recarregar };
}
