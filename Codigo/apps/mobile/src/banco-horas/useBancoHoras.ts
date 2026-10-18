import { useCallback, useEffect, useState } from 'react';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { sincronizar } from '../sincronizacao/syncManager';
import { buscarBancoHoras } from './clienteBancoHoras';
import {
  COLUNAS_OBSERVADAS_DE_BANCO_HORAS,
  paraBancoHorasDTO,
  queryBancoHoras,
} from './espelhoBancoHoras';

export interface EstadoBancoHoras {
  bancoHoras: BancoHorasDTO | null;
  carregando: boolean;
  /** Mês que não está na réplica (fora da janela do pull) e o servidor não respondeu agora. */
  semDadosOffline: boolean;
  /** Sincroniza e, se o mês não está na réplica, tenta o servidor de novo. */
  recarregar: () => Promise<void>;
}

/** Resultado de uma leitura tagueado pelo mês: ao trocar de mês, a leitura antiga é ignorada no render. */
interface PorMes<T> {
  chave: string;
  valor: T;
}

const chaveDoMes = (mes: number, ano: number) => `${ano}-${mes}`;

/**
 * Saldo do banco de horas do mês/ano pedidos. A fonte é a réplica (o pull traz
 * o mês corrente e os 2 anteriores). Mês fora dela: com rede, busca no servidor
 * e guarda o resultado só neste hook (estado TRANSITÓRIO — a réplica só é
 * escrita pelo `synchronize()`); sem rede, `semDadosOffline`.
 */
export function useBancoHoras(mes: number, ano: number): EstadoBancoHoras {
  const database = useDatabaseOuFalha();
  const chave = chaveDoMes(mes, ano);

  const [leitura, setLeitura] = useState<PorMes<BancoHorasDTO | null> | null>(null);
  const [consulta, setConsulta] = useState<PorMes<BancoHorasDTO | 'falha'> | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const assinatura = queryBancoHoras(database, mes, ano)
      .observeWithColumns(COLUNAS_OBSERVADAS_DE_BANCO_HORAS)
      .subscribe((registros) =>
        setLeitura({ chave, valor: registros.length > 0 ? paraBancoHorasDTO(registros[0]) : null }),
      );
    return () => assinatura.unsubscribe();
  }, [database, mes, ano, chave]);

  // `undefined`: a réplica ainda não respondeu para ESTE mês.
  const daReplica = leitura?.chave === chave ? leitura.valor : undefined;
  const precisaDoServidor = daReplica === null;

  useEffect(() => {
    if (!precisaDoServidor) return;
    let cancelado = false;
    buscarBancoHoras(mes, ano).then(
      (dto) => {
        if (!cancelado) setConsulta({ chave, valor: dto });
      },
      () => {
        if (!cancelado) setConsulta({ chave, valor: 'falha' });
      },
    );
    return () => {
      cancelado = true;
    };
  }, [precisaDoServidor, mes, ano, chave, tentativa]);

  const doServidor = consulta?.chave === chave ? consulta.valor : null;
  const bancoHoras = daReplica ?? (doServidor !== null && doServidor !== 'falha' ? doServidor : null);

  const recarregar = useCallback(async () => {
    setConsulta(null);
    setTentativa((anterior) => anterior + 1);
    await sincronizar(database);
  }, [database]);

  return {
    bancoHoras,
    carregando: daReplica === undefined || (daReplica === null && doServidor === null),
    semDadosOffline: daReplica === null && doServidor === 'falha',
    recarregar,
  };
}
