import { useEffect } from 'react';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { observarFila } from './observarFila';
import { iniciarSincronizacao } from './syncManager';

/**
 * Dono da sincronização enquanto há sessão: liga os gatilhos (boot, volta de
 * rede, retorno ao primeiro plano) e a observação da fila uma única vez e os
 * desliga quando o app autenticado desmonta (logout). Chamado por
 * `AppAutenticado`, acima das abas: trocar de aba não mexe nos listeners, e
 * qualquer aba lê o status no `useSincronizacaoStore`.
 */
export function useSincronizacaoDoApp(): void {
  const database = useDatabaseOuFalha();

  useEffect(() => iniciarSincronizacao(database), [database]);
  useEffect(() => observarFila(database), [database]);
}
