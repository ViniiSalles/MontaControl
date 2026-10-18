import type { EstadoDaSincronizacao } from '../estado/sincronizacaoStore';

/** O que o indicador precisa do store de sincronização. */
export type EntradaDoStatus = Pick<
  EstadoDaSincronizacao,
  'online' | 'sincronizando' | 'pendentes' | 'ultimaSincronizacaoEm' | 'ultimoErro'
>;

export interface StatusDescrito {
  /** Mesmas variantes do `Badge`: `sucesso` em dia, `info` em andamento, `aviso` atenção, `erro` precisa de ação. */
  variante: 'sucesso' | 'info' | 'aviso' | 'erro' | 'neutro';
  texto: string;
}

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/** Há quanto tempo, em palavras ("agora", "há 5 min", "há 3 h", "há 2 dias"). Nunca negativo. */
export function formatarHa(decorridoMs: number): string {
  if (decorridoMs < MINUTO_MS) return 'agora';
  if (decorridoMs < HORA_MS) return `há ${Math.floor(decorridoMs / MINUTO_MS)} min`;
  if (decorridoMs < DIA_MS) return `há ${Math.floor(decorridoMs / HORA_MS)} h`;
  const dias = Math.floor(decorridoMs / DIA_MS);
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

function textoDePendentes(pendentes: number): string {
  return `${pendentes} ${pendentes === 1 ? 'pendente' : 'pendentes'}`;
}

/**
 * Traduz o store de sincronização no texto curto do indicador (todas as abas).
 * Função pura: `agora` entra de fora para o "há X" ser testável. Ordem de
 * prioridade: o que o montador precisa fazer (atualizar o app) > o que está
 * acontecendo agora > conexão > erro > fila > última sincronização.
 */
export function descreverStatus(estado: EntradaDoStatus, agora: number): StatusDescrito {
  const { online, sincronizando, pendentes, ultimaSincronizacaoEm, ultimoErro } = estado;
  const comFila = (texto: string) =>
    pendentes > 0 ? `${texto} · ${textoDePendentes(pendentes)}` : texto;

  if (ultimoErro === 'versao_incompativel') {
    return { variante: 'erro', texto: 'Atualize o aplicativo para sincronizar' };
  }
  if (sincronizando) return { variante: 'info', texto: comFila('Sincronizando…') };
  if (!online) return { variante: 'aviso', texto: comFila('Sem conexão') };
  if (ultimoErro === 'falha' || ultimoErro === 'sessao') {
    return { variante: 'erro', texto: comFila('Falha ao sincronizar') };
  }
  if (ultimoErro === 'sem_rede') {
    return { variante: 'aviso', texto: comFila('Servidor sem resposta') };
  }
  if (pendentes > 0) return { variante: 'aviso', texto: textoDePendentes(pendentes) };
  if (ultimaSincronizacaoEm !== null) {
    return {
      variante: 'sucesso',
      texto: `Sincronizado ${formatarHa(Math.max(0, agora - ultimaSincronizacaoEm))}`,
    };
  }
  return { variante: 'neutro', texto: 'Aguardando a primeira sincronização' };
}
