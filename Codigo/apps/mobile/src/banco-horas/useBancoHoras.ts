import { useCallback, useEffect, useState } from 'react';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { paraBancoHorasDTO, queryBancoHoras } from './espelhoBancoHoras';
import { puxarBancoHoras } from '../sincronizacao/syncManager';

export interface EstadoBancoHoras {
  bancoHoras: BancoHorasDTO | null;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

/** Saldo do banco de horas do mês/ano pedidos, lido do espelho local. Recarrega ao trocar de período. */
export function useBancoHoras(mes: number, ano: number): EstadoBancoHoras {
  const database = useDatabaseOuFalha();
  const [bancoHoras, setBancoHoras] = useState<BancoHorasDTO | null>(null);
  const [carregandoLocal, setCarregandoLocal] = useState(true);
  const [falhaRede, setFalhaRede] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      await puxarBancoHoras(database, mes, ano);
      setFalhaRede(false);
    } catch {
      setFalhaRede(true);
    }
  }, [database, mes, ano]);

  useEffect(() => {
    const assinatura = queryBancoHoras(database, mes, ano)
      .observe()
      .subscribe((registros) => {
        setBancoHoras(registros.length > 0 ? paraBancoHorasDTO(registros[0]) : null);
        setCarregandoLocal(false);
      });
    return () => assinatura.unsubscribe();
  }, [database, mes, ano]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return {
    bancoHoras,
    carregando: carregandoLocal,
    erro: falhaRede && bancoHoras === null,
    recarregar,
  };
}
