import { useCallback, useEffect, useState } from 'react';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { buscarBancoHoras } from './clienteBancoHoras';

export interface EstadoBancoHoras {
  bancoHoras: BancoHorasDTO | null;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Saldo do banco de horas do mês/ano pedidos. Recarrega ao trocar de período. */
export function useBancoHoras(token: string, mes: number, ano: number): EstadoBancoHoras {
  const [bancoHoras, setBancoHoras] = useState<BancoHorasDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resultado = await buscarBancoHoras(token, mes, ano);
      setBancoHoras(resultado);
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [token, mes, ano]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { bancoHoras, carregando, erro, recarregar };
}
