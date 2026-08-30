import type {
  CheckinRequest,
  CheckoutRequest,
  CorpoErroPadrao,
  HistoricoJornadasDTO,
  JornadaDTO,
  PeriodoHistorico,
  SolicitacaoPontoDTO,
  SolicitarPontoEmAtrasoRequest,
} from '@montacontrol/shared';
import { urlBaseApi } from '../config/api';

/**
 * Erro de resposta da API com o `codigo` do corpo padrão e o `status` HTTP
 * preservados. O `status` é o que a outbox usa para decidir entre descartar
 * (4xx: a regra recusou, retentar não muda nada) e retentar (5xx).
 */
export class ErroApi extends Error {
  readonly codigo: string;
  readonly status: number;

  constructor(codigo: string, mensagem: string, status: number) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

async function lerErro(resposta: Response): Promise<ErroApi> {
  const corpo = (await resposta.json().catch(() => null)) as CorpoErroPadrao | null;
  return new ErroApi(
    corpo?.codigo ?? 'ERRO_DESCONHECIDO',
    corpo?.message ?? 'Não foi possível concluir a operação.',
    resposta.status,
  );
}

async function postar<T>(caminho: string, token: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${urlBaseApi}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as T;
}

export async function enviarCheckin(token: string, dados: CheckinRequest): Promise<JornadaDTO> {
  return postar<JornadaDTO>('/api/jornadas/checkin', token, dados);
}

export async function enviarCheckout(token: string, dados: CheckoutRequest): Promise<JornadaDTO> {
  return postar<JornadaDTO>('/api/jornadas/checkout', token, dados);
}

export async function enviarSolicitacaoPonto(
  token: string,
  dados: SolicitarPontoEmAtrasoRequest,
): Promise<SolicitacaoPontoDTO> {
  return postar<SolicitacaoPontoDTO>('/api/pontos-em-atraso', token, dados);
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
export async function buscarJornadaAtual(token: string): Promise<JornadaDTO | null> {
  const resposta = await fetch(`${urlBaseApi}/api/jornadas/atual`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) throw await lerErro(resposta);

  const corpo = await resposta.text();
  if (!corpo) return null;
  return JSON.parse(corpo) as JornadaDTO | null;
}

/** GET /api/jornadas/historico — dias agrupados do período (5, 15 ou 30 dias). */
export async function buscarHistorico(
  token: string,
  dias: PeriodoHistorico,
): Promise<HistoricoJornadasDTO> {
  const resposta = await fetch(`${urlBaseApi}/api/jornadas/historico?dias=${dias}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) throw await lerErro(resposta);
  return (await resposta.json()) as HistoricoJornadasDTO;
}
