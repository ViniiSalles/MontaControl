import type { ReactNode } from 'react';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import type { Database } from '@nozbe/watermelondb';
import { useSincronizacaoDoApp } from '../../sincronizacao/useSincronizacaoDoApp';

/** `wrapper` de `renderHook`/`render` que entrega o banco de teste aos hooks de leitura. */
export function comBanco(database: Database) {
  return function ComBanco({ children }: { children: ReactNode }) {
    return <DatabaseProvider database={database}>{children}</DatabaseProvider>;
  };
}

/** Faz o que `AppAutenticado` faz acima das abas: liga a sincronização e a observação da fila (precisa de `DatabaseProvider`). */
export function ComSincronizacaoDoApp({ children }: { children: ReactNode }) {
  useSincronizacaoDoApp();
  return <>{children}</>;
}

/** Como `comBanco`, com a sincronização do app autenticado (telas que leem avisos/pendências da fila). */
export function comBancoESincronizacao(database: Database) {
  return function ComBancoESincronizacao({ children }: { children: ReactNode }) {
    return (
      <DatabaseProvider database={database}>
        <ComSincronizacaoDoApp>{children}</ComSincronizacaoDoApp>
      </DatabaseProvider>
    );
  };
}
