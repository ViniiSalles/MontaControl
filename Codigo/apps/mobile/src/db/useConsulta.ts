import { useEffect, useState } from 'react';
import type { Database, Model, Query } from '@nozbe/watermelondb';
import { useDatabaseOuFalha } from './useDatabase';

/**
 * Assina uma consulta do banco local e devolve as linhas já convertidas em
 * objetos simples (o registro do WatermelonDB é mutado no lugar por um
 * `synchronize()`; a tela recebe uma cópia). `null` até a primeira emissão.
 *
 * Usa `observeWithColumns`: `observe()` sozinho só reage a entrada/saída de
 * registro, e o pull atualiza linhas existentes no lugar (ex.: o parecer de
 * uma avaria). `criarQuery`, `colunas` e `paraLinha` precisam ser estáveis
 * (constantes de módulo): entram nas dependências da assinatura.
 */
export function useConsulta<M extends Model, L>(
  criarQuery: (database: Database) => Query<M>,
  colunas: readonly string[],
  paraLinha: (registro: M) => L,
): L[] | null {
  const database = useDatabaseOuFalha();
  const [linhas, setLinhas] = useState<L[] | null>(null);

  useEffect(() => {
    const consulta = criarQuery(database);
    const assinatura = consulta
      .observeWithColumns([...colunas])
      .subscribe((registros) => setLinhas(registros.map(paraLinha)));
    return () => assinatura.unsubscribe();
  }, [database, criarQuery, colunas, paraLinha]);

  return linhas;
}
