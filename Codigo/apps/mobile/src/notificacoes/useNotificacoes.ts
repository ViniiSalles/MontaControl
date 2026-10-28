import { useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import type { Database, Query } from '@nozbe/watermelondb';
import type { ReferenciaNotificacao, TipoNotificacao } from '@montacontrol/shared';
import { Notificacao } from '../db/Notificacao';
import { useConsulta } from '../db/useConsulta';

/** Notificação da réplica como objeto simples (o registro do WatermelonDB é mutado no lugar pelo pull). */
export interface NotificacaoLocal {
  /** Id do servidor, como string (id local da réplica). */
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  referenciaTipo: ReferenciaNotificacao | null;
  referenciaId: string | null;
  lida: boolean;
  /** ISO 8601. */
  criadaEm: string;
}

/** `lida` muda no lugar quando o pull traz a notificação lida em outro aparelho. */
const COLUNAS_OBSERVADAS_DE_NOTIFICACAO = ['lida', 'titulo', 'mensagem'];

const queryNotificacoes = (database: Database): Query<Notificacao> =>
  database.get<Notificacao>('notificacoes').query(Q.sortBy('criada_em', Q.desc));

const paraNotificacaoLocal = (notificacao: Notificacao): NotificacaoLocal => ({
  id: notificacao.id,
  tipo: notificacao.tipo,
  titulo: notificacao.titulo,
  mensagem: notificacao.mensagem,
  referenciaTipo: notificacao.referenciaTipo,
  referenciaId: notificacao.referenciaId,
  lida: notificacao.lida,
  criadaEm: notificacao.criadaEm,
});

/**
 * Notificações do montador lidas da réplica local (do mais novo para o mais
 * antigo) e quantas ainda não foram lidas. Não vai à rede: quem traz as novas
 * é a sincronização. Lista vazia até a primeira leitura do banco.
 */
export function useNotificacoes(): { itens: NotificacaoLocal[]; naoLidas: number } {
  const linhas = useConsulta(queryNotificacoes, COLUNAS_OBSERVADAS_DE_NOTIFICACAO, paraNotificacaoLocal);

  return useMemo(() => {
    const itens = linhas ?? [];
    return { itens, naoLidas: itens.filter((item) => !item.lida).length };
  }, [linhas]);
}
