import type { ReactNode } from 'react';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import type { Database } from '@nozbe/watermelondb';
import { ProvedorSincronizacao } from '../../sincronizacao/SincronizacaoContext';

/** `wrapper` de `renderHook`/`render` que entrega o banco de teste aos hooks de leitura. */
export function comBanco(database: Database) {
  return function ComBanco({ children }: { children: ReactNode }) {
    return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
  };
}

/** Como `comBanco`, com o `ProvedorSincronizacao` do app autenticado (telas que leem avisos/pendências da fila). */
export function comBancoESincronizacao(database: Database) {
  return function ComBancoESincronizacao({ children }: { children: ReactNode }) {
    return (
      <DatabaseProvider database={database}>
        <ProvedorSincronizacao>{children}</ProvedorSincronizacao>
      </DatabaseProvider>
    );
  };
}
