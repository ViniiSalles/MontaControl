import { useDatabase } from '@nozbe/watermelondb/react';
import type { Database } from '@nozbe/watermelondb';

/** Mesmo padrão de `useAuth` (`auth/AuthContext.tsx`) — falha alto se usado fora do Provider. */
export function useDatabaseOuFalha(): Database {
  const database = useDatabase();
  if (!database) throw new Error('useDatabaseOuFalha deve ser usado dentro de <DatabaseProvider>');
  return database;
}
