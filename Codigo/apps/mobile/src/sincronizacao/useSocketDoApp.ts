import { useEffect } from 'react';
import { useDatabaseOuFalha } from '../db/useDatabase';
import { iniciarSocket } from './iniciarSocket';

/**
 * Liga o canal de tempo real enquanto há sessão e o desliga no logout. Chamado
 * por `AppAutenticado`, ao lado de `useSincronizacaoDoApp`: um evento do
 * servidor só acorda a sincronização que aquele hook mantém.
 */
export function useSocketDoApp(): void {
  const database = useDatabaseOuFalha();

  useEffect(() => iniciarSocket(database), [database]);
}
