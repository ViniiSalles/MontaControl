import { useCallback, useEffect, useState } from 'react';
import type { AvariaDTO, PedidoDoMontadorDTO, TipoAvariaDTO } from '@montacontrol/shared';
import { listarMeusPedidos } from '../pedidos/clientePedidos';
import { listarMinhasAvarias, listarTiposAvaria } from './clienteAvarias';

export interface EstadoDadosAvarias {
  pedidos: PedidoDoMontadorDTO[];
  tipos: TipoAvariaDTO[];
  avarias: AvariaDTO[];
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/**
 * Pedidos do montador, tipos de problema e histórico de reportes. Leitura
 * online; só o envio passa pela outbox, que é o que não pode se perder.
 */
export function useDadosAvarias(token: string): EstadoDadosAvarias {
  const [pedidos, setPedidos] = useState<PedidoDoMontadorDTO[]>([]);
  const [tipos, setTipos] = useState<TipoAvariaDTO[]>([]);
  const [avarias, setAvarias] = useState<AvariaDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setErro(false);
    try {
      const [meusPedidos, listaTipos, minhas] = await Promise.all([
        listarMeusPedidos(token),
        listarTiposAvaria(token),
        listarMinhasAvarias(token),
      ]);
      setPedidos(meusPedidos);
      setTipos(listaTipos);
      setAvarias(minhas);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { pedidos, tipos, avarias, carregando, erro, recarregar };
}
