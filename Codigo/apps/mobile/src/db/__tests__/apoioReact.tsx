import type { ReactNode } from 'react';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import type { Database } from '@nozbe/watermelondb';

/** `wrapper` de `renderHook`/`render` que entrega o banco de teste aos hooks de leitura. */
export function comBanco(database: Database) {
  return function ComBanco({ children }: { children: ReactNode }) {
    return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
  };
}
