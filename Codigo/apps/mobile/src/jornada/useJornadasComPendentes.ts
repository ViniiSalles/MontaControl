import { useEffect, useMemo, useState } from 'react';
import { useDatabaseOuFalha } from '../db/useDatabase';
import {
  COLUNAS_OBSERVADAS_DE_JORNADA,
  paraAcaoDeJornada,
  paraJornadaExibida,
  queryAcoesDeJornada,
  queryJornadas,
  sobreporAcoesPendentes,
} from './jornadasComPendentes';
import type { AcaoDeJornada, JornadaExibida } from './jornadasComPendentes';

export interface EstadoJornadasComPendentes {
  jornadas: JornadaExibida[];
  /** `true` até a réplica e a fila terem emitido a primeira leitura. */
  carregando: boolean;
}

/**
 * Jornadas como a tela mostra: a réplica (escrita só pelo `synchronize()`) com
 * as ações de check-in/check-out ainda na fila por cima. Não vai à rede — quem
 * sincroniza é o provider do app (`useSincronizacaoDoApp`); a leitura reage
 * sozinha quando o pull grava ou a fila muda.
 *
 * Duas assinaturas separadas e o resultado derivado no render: a sobreposição
 * é função pura das duas listas, sem estado duplicado.
 */
export function useJornadasComPendentes(): EstadoJornadasComPendentes {
  const database = useDatabaseOuFalha();
  const [replica, setReplica] = useState<JornadaExibida[] | null>(null);
  const [acoes, setAcoes] = useState<AcaoDeJornada[] | null>(null);

  useEffect(() => {
    // `observeWithColumns`: o pull atualiza jornadas existentes (ex.: check-out
    // preenchido) e `observe()` sozinho só emite quando o conjunto muda.
    const assinatura = queryJornadas(database)
      .observeWithColumns(COLUNAS_OBSERVADAS_DE_JORNADA)
      .subscribe((registros) => setReplica(registros.map(paraJornadaExibida)));
    return () => assinatura.unsubscribe();
  }, [database]);

  useEffect(() => {
    // `observe()` basta: a fila só entra/sai do conjunto (pendente/enviada ↔ apagada/descartada).
    const assinatura = queryAcoesDeJornada(database)
      .observe()
      .subscribe((registros) =>
        setAcoes(registros.flatMap((registro) => paraAcaoDeJornada(registro) ?? [])),
      );
    return () => assinatura.unsubscribe();
  }, [database]);

  const jornadas = useMemo(
    () => sobreporAcoesPendentes(replica ?? [], acoes ?? []),
    [replica, acoes],
  );

  return { jornadas, carregando: replica === null || acoes === null };
}
