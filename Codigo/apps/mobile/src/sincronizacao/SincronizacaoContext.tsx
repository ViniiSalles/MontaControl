import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Q } from '@nozbe/watermelondb';
import { AcaoPendente } from '../db/AcaoPendente';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { iniciarSincronizacao } from './syncManager';

export interface EstadoSincronizacao {
  /** Ações na fila ainda não confirmadas pelo servidor. */
  pendentes: number;
  /** Mensagens das ações que o servidor recusou; a ação já saiu da fila. */
  avisosDescartados: string[];
  /** Esconde os avisos já lidos. */
  dispensarAvisos: () => void;
}

const SincronizacaoContext = createContext<EstadoSincronizacao | null>(null);

/**
 * Dono da sincronização enquanto há sessão: liga os gatilhos (boot, volta de
 * rede, retorno ao primeiro plano) uma única vez e os desliga quando o app
 * autenticado desmonta (logout). Como fica acima das abas, trocar de aba não
 * mexe nos listeners, e qualquer aba lê o status da fila daqui.
 *
 * Provisório: a issue de estado global (Zustand) substitui este contexto.
 */
export function ProvedorSincronizacao({ children }: { children: ReactNode }) {
  const database = useDatabaseOuFalha();
  const [pendentes, setPendentes] = useState(0);
  const [avisosDescartados, setAvisosDescartados] = useState<string[]>([]);

  useEffect(() => iniciarSincronizacao(database), [database]);

  useEffect(() => {
    const colecao = database.get<AcaoPendente>('acoes_pendentes');

    // `observeCount(false)`: a versão throttled do WatermelonDB descarta as
    // mudanças dentro da janela de 250 ms (bug conhecido dela), o que deixaria
    // o contador preso num valor velho quando a fila muda em rajada.
    const assinaturaPendentes = colecao
      .query(Q.where('status', 'pendente'))
      .observeCount(false)
      .subscribe(setPendentes);

    const assinaturaDescartadas = colecao
      .query(Q.where('status', 'descartada'))
      .observe()
      .subscribe((registros) => {
        if (registros.length === 0) return;
        setAvisosDescartados(registros.map((registro) => registro.mensagemDescarte ?? ''));
        void database.write(() =>
          database.batch(...registros.map((registro) => registro.prepareDestroyPermanently())),
        );
      });

    return () => {
      assinaturaPendentes.unsubscribe();
      assinaturaDescartadas.unsubscribe();
    };
  }, [database]);

  const dispensarAvisos = useCallback(() => setAvisosDescartados([]), []);

  const valor = useMemo<EstadoSincronizacao>(
    () => ({ pendentes, avisosDescartados, dispensarAvisos }),
    [pendentes, avisosDescartados, dispensarAvisos],
  );

  return <SincronizacaoContext.Provider value={valor}>{children}</SincronizacaoContext.Provider>;
}

/** Mesmo padrão de `useAuth` — falha alto se usado fora do Provider. */
export function useSincronizacao(): EstadoSincronizacao {
  const contexto = useContext(SincronizacaoContext);
  if (!contexto)
    throw new Error('useSincronizacao deve ser usado dentro de <ProvedorSincronizacao>');
  return contexto;
}
