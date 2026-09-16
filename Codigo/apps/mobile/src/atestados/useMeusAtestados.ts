import { useCallback, useEffect, useState } from 'react';
import type { AtestadoDTO } from '@montacontrol/shared';
import { listarMeusAtestados } from './clienteAtestados';

export interface EstadoMeusAtestados {
  atestados: AtestadoDTO[];
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Online-only, sem espelho local: enviar atestado não é ação de campo sem sinal. */
export function useMeusAtestados(token: string): EstadoMeusAtestados {
  const [atestados, setAtestados] = useState<AtestadoDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setErro(false);
    try {
      setAtestados(await listarMeusAtestados(token));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { atestados, carregando, erro, recarregar };
}
