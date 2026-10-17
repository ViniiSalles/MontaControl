import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@nozbe/watermelondb';
import { listarMeusPedidos } from './clientePedidos';
import { guardarObras, lerObras } from './obrasLocais';
import type { ObraDoPonto } from './obrasLocais';

export interface EstadoObras {
  obras: ObraDoPonto[];
  carregando: boolean;
  /** Não leu do servidor; `obras` é a última cópia local (pode estar vazia). */
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Obras em que o montador pode bater ponto: servidor quando há rede, cópia local quando não. */
export function useObrasDoMontador(database: Database): EstadoObras {
  const [obras, setObras] = useState<ObraDoPonto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setErro(false);
    try {
      const pedidos = await listarMeusPedidos();
      setObras(pedidos);
      // Sem a cópia local só se perde o ponto offline; a tela segue com a lista lida.
      await guardarObras(database, pedidos).catch(() => undefined);
    } catch {
      setErro(true);
      setObras(await lerObras(database).catch(() => []));
    } finally {
      setCarregando(false);
    }
  }, [database]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { obras, carregando, erro, recarregar };
}
