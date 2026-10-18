import type {
  CheckinRequest,
  CheckoutRequest,
  HistoricoJornadasDTO,
  JornadaDTO,
  PeriodoHistorico,
  SolicitacaoPontoDTO,
  SolicitarPontoEmAtrasoRequest,
} from '@montacontrol/shared';
import { requisitarAutenticado } from '../http/requisicao';

// `ErroApi`/`lerErro` moram em `http/erroApi` (a camada de token precisa deles
// sem importar um cliente de domínio); reexportados aqui por compatibilidade.
export { ErroApi, lerErro } from '../http/erroApi';

/** Opções dos envios feitos pela fila: `geracao` amarra a requisição à sessão que a enfileirou. */
export interface OpcoesEnvio {
  geracao?: number;
}

async function postar<T>(caminho: string, corpo: unknown, opcoes: OpcoesEnvio = {}): Promise<T> {
  const resposta = await requisitarAutenticado(caminho, {
    metodo: 'POST',
    corpo,
    geracao: opcoes.geracao,
  });
  return (await resposta.json()) as T;
}

export async function enviarCheckin(
  dados: CheckinRequest,
  opcoes?: OpcoesEnvio,
): Promise<JornadaDTO> {
  return postar<JornadaDTO>('/api/jornadas/checkin', dados, opcoes);
}

export async function enviarCheckout(
  dados: CheckoutRequest,
  opcoes?: OpcoesEnvio,
): Promise<JornadaDTO> {
  return postar<JornadaDTO>('/api/jornadas/checkout', dados, opcoes);
}

export async function enviarSolicitacaoPonto(
  dados: SolicitarPontoEmAtrasoRequest,
  opcoes?: OpcoesEnvio,
): Promise<SolicitacaoPontoDTO> {
  return postar<SolicitacaoPontoDTO>('/api/pontos-em-atraso', dados, opcoes);
}

/**
 * GET /api/jornadas/atual — jornada aberta do montador, ou `null` se não houver
 * nenhuma.
 *
 * O corpo vazio precisa ser tratado: o Nest responde 200 **sem corpo** quando o
 * handler devolve `null` (é o caso normal do montador que ainda não bateu o
 * ponto do dia), e `resposta.json()` estoura em corpo vazio. Sem isto, o "sem
 * jornada" chegaria à tela como falha de carregamento.
 */
export async function buscarJornadaAtual(): Promise<JornadaDTO | null> {
  const resposta = await requisitarAutenticado('/api/jornadas/atual');

  const corpo = await resposta.text();
  if (!corpo) return null;
  return JSON.parse(corpo) as JornadaDTO | null;
}

/** GET /api/jornadas/historico — dias agrupados do período (5, 15 ou 30 dias). */
export async function buscarHistorico(dias: PeriodoHistorico): Promise<HistoricoJornadasDTO> {
  const resposta = await requisitarAutenticado(`/api/jornadas/historico?dias=${dias}`);
  return (await resposta.json()) as HistoricoJornadasDTO;
}
