import type {
  EnviarAtestadoRequest,
  FotoBase64,
  ReportarAvariaRequest,
} from '@montacontrol/shared';
import { apagarFotos, ErroFotoIndisponivel, lerFotoParaEnvio } from '../fotos/armazenamentoFotos';

/**
 * O que a fila guarda de avaria e de atestado: o corpo da API, mas com as
 * fotos como CAMINHOS de arquivo (`fotosCaminhos`) em vez de base64 — o base64
 * só nasce no envio (`montarCorpoAvaria` / `montarCorpoAtestado`).
 *
 * `fotos` (base64 dentro do payload) é o formato das versões anteriores do app;
 * ações gravadas assim ainda podem estar na fila de um aparelho e sobem como
 * estavam.
 */
interface FotosNaFila {
  fotosCaminhos?: string[];
  fotos?: FotoBase64[];
}

export type PayloadAvariaNaFila = Omit<ReportarAvariaRequest, 'fotos'> & FotosNaFila;
export type PayloadAtestadoNaFila = Omit<EnviarAtestadoRequest, 'fotos'> & FotosNaFila;

/** Caminhos das fotos de um payload lido do disco (JSON de uma ação da fila). */
export function caminhosDasFotos(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const { fotosCaminhos } = payload as FotosNaFila;
  return Array.isArray(fotosCaminhos)
    ? fotosCaminhos.filter((caminho): caminho is string => typeof caminho === 'string')
    : [];
}

/** Caminhos das fotos de uma ação da fila (`payload` ainda em texto); payload ilegível não tem fotos. */
export function caminhosDasFotosDaAcao(payloadEmTexto: string): string[] {
  try {
    return caminhosDasFotos(JSON.parse(payloadEmTexto));
  } catch {
    return [];
  }
}

/** Lê as fotos do disco; as que sumiram ficam de fora (o chamador decide se isso importa). */
async function carregarFotos(payload: FotosNaFila): Promise<FotoBase64[]> {
  if (payload.fotos) return payload.fotos;
  const fotos: FotoBase64[] = [];
  for (const caminho of caminhosDasFotos(payload)) {
    try {
      fotos.push(await lerFotoParaEnvio(caminho));
    } catch (erro) {
      if (!(erro instanceof ErroFotoIndisponivel)) throw erro;
    }
  }
  return fotos;
}

function semCaminhos<T extends FotosNaFila>(payload: T): Omit<T, 'fotosCaminhos' | 'fotos'> {
  const { fotosCaminhos: _caminhos, fotos: _fotos, ...resto } = payload;
  return resto;
}

/** Foto de avaria é opcional (peça faltando não tem o que fotografar): sobe com as que restam. */
export async function montarCorpoAvaria(
  payload: PayloadAvariaNaFila,
): Promise<ReportarAvariaRequest> {
  const fotos = await carregarFotos(payload);
  return { ...semCaminhos(payload), ...(fotos.length > 0 ? { fotos } : {}) };
}

/** `null` quando não resta nenhuma foto: atestado sem documento não é analisável, o envio seria recusado. */
export async function montarCorpoAtestado(
  payload: PayloadAtestadoNaFila,
): Promise<EnviarAtestadoRequest | null> {
  const fotos = await carregarFotos(payload);
  return fotos.length > 0 ? { ...semCaminhos(payload), fotos } : null;
}

/**
 * Apaga as fotos de uma ação já resolvida (enviada ou recusada). Nunca falha:
 * a ação já foi resolvida e um arquivo que não saiu só fica órfão até o
 * próximo logout, que esvazia a pasta inteira.
 */
export async function apagarFotosDaAcao(caminhos: readonly string[]): Promise<void> {
  await apagarFotos(caminhos).catch(() => undefined);
}

/** Código e mensagem do descarte de um atestado cujas fotos já não estão no aparelho. */
export const CODIGO_ATESTADO_SEM_FOTOS = 'ATESTADO_SEM_FOTOS';
export const MENSAGEM_ATESTADO_SEM_FOTOS =
  'Atestado não enviado: as fotos não estão mais no aparelho. Envie de novo.';
