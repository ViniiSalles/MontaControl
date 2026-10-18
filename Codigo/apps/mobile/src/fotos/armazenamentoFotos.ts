import { Directory, File, Paths } from 'expo-file-system';
import type { FotoBase64 } from '@montacontrol/shared';

/**
 * Fotos de avaria e de atestado ficam como ARQUIVO no aparelho (nunca como
 * base64 no SQLite, onde uma linha passava de vários MB): a fila guarda só o
 * caminho, e o base64 só nasce na hora do envio. Tudo mora numa subpasta do
 * diretório de documentos do app, o que permite apagar tudo de uma vez no
 * logout e recusar qualquer caminho de fora dela.
 */
const NOME_DA_PASTA = 'fotos_pendentes';

export type MimeTypeFoto = FotoBase64['mimeType'];

const EXTENSAO_POR_MIME: Record<MimeTypeFoto, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** A foto sumiu do aparelho (ou nunca existiu) — quem enviava decide o que fazer sem ela. */
export class ErroFotoIndisponivel extends Error {
  constructor(public readonly caminho: string) {
    super(`Foto indisponível: ${caminho}`);
    this.name = 'ErroFotoIndisponivel';
  }
}

function pasta(): Directory {
  return new Directory(Paths.document, NOME_DA_PASTA);
}

function semBarraFinal(uri: string): string {
  return uri.replace(/\/+$/, '');
}

/** Só o que está dentro da pasta de fotos pode ser apagado: o caminho vem de um payload gravado em disco. */
function estaNaPasta(caminho: string): boolean {
  return caminho.startsWith(`${semBarraFinal(pasta().uri)}/`);
}

let sequencia = 0;

function novoNomeDeArquivo(mimeType: MimeTypeFoto): string {
  sequencia += 1;
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${sequencia}-${aleatorio}${EXTENSAO_POR_MIME[mimeType]}`;
}

/** JPEG e PNG são o que a API aceita; qualquer outra coisa (HEIC, tipo ausente) é `null`. */
export function mimeTypeSuportado(mimeType: string | null | undefined): MimeTypeFoto | null {
  return mimeType === 'image/jpeg' || mimeType === 'image/png' ? mimeType : null;
}

function mimeTypeDoCaminho(caminho: string): MimeTypeFoto {
  return caminho.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

/**
 * Copia a foto (normalmente o arquivo temporário do picker) para a pasta do
 * app e devolve o caminho do arquivo guardado — é ele que vai para a fila e
 * para o rascunho do formulário.
 */
export async function salvarFoto(uri: string, mimeType: MimeTypeFoto = 'image/jpeg'): Promise<string> {
  pasta().create({ intermediates: true, idempotent: true });
  const destino = new File(pasta(), novoNomeDeArquivo(mimeType));
  try {
    await new File(uri).copy(destino);
  } catch (erro) {
    if (destino.exists) destino.delete();
    throw erro;
  }
  return destino.uri;
}

/** Conteúdo da foto em base64, sem prefixo `data:`. Lança `ErroFotoIndisponivel` se o arquivo não existe. */
export async function lerFotoBase64(caminho: string): Promise<string> {
  const arquivo = new File(caminho);
  if (!arquivo.exists) throw new ErroFotoIndisponivel(caminho);
  try {
    return await arquivo.base64();
  } catch {
    throw new ErroFotoIndisponivel(caminho);
  }
}

/** A foto no formato do corpo da API; o mime sai da extensão que `salvarFoto` escolheu. */
export async function lerFotoParaEnvio(caminho: string): Promise<FotoBase64> {
  return { conteudoBase64: await lerFotoBase64(caminho), mimeType: mimeTypeDoCaminho(caminho) };
}

/** Apaga as fotos pedidas. Arquivo que já não existe não é erro; caminho fora da pasta de fotos é ignorado. */
export async function apagarFotos(caminhos: readonly string[]): Promise<void> {
  for (const caminho of caminhos) {
    if (!estaNaPasta(caminho)) continue;
    const arquivo = new File(caminho);
    if (arquivo.exists) arquivo.delete();
  }
}

/** Esvazia a pasta de fotos (logout, troca de usuário). Sem pasta, não há o que fazer. */
export async function apagarTodasAsFotos(): Promise<void> {
  const diretorio = pasta();
  if (diretorio.exists) diretorio.delete();
}
