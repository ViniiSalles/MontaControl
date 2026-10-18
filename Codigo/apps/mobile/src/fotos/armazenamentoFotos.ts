import { Directory, File, Paths } from 'expo-file-system';
import type { FotoBase64 } from '@montacontrol/shared';

/**
 * Fotos de avaria e de atestado ficam como ARQUIVO no aparelho (nunca como
 * base64 no SQLite, onde uma linha passava de vários MB): a fila guarda só a
 * referência, e o base64 só nasce na hora do envio. Tudo mora numa subpasta do
 * diretório de documentos do app, o que permite apagar tudo de uma vez no
 * logout.
 *
 * A referência é o NOME do arquivo (relativo à pasta): o prefixo absoluto do
 * container muda no iOS a cada update/restore, e um caminho absoluto gravado na
 * fila deixaria de apontar para a foto. Referências com caminho (absoluto, de
 * versões anteriores) continuam aceitas: só o último segmento conta e ele é
 * resolvido na pasta atual — o que também impede que um payload adulterado
 * aponte para fora dela.
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

/** Último segmento da referência; `null` se não sobra um nome de arquivo utilizável (`''`, `.`, `..`). */
function nomeDoArquivo(referencia: string): string | null {
  const nome = referencia.split(/[\\/]/).pop() ?? '';
  return nome === '' || nome === '.' || nome === '..' ? null : nome;
}

/** O arquivo da foto na pasta atual do app, qualquer que seja o formato da referência. */
function arquivoDaFoto(referencia: string): File | null {
  const nome = nomeDoArquivo(referencia);
  return nome === null ? null : new File(pasta(), nome);
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

function mimeTypeDaReferencia(referencia: string): MimeTypeFoto {
  return referencia.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

/** URI do arquivo da foto, para mostrar a miniatura (`<Image source={{ uri }}>`). */
export function uriDaFoto(referencia: string): string {
  return (arquivoDaFoto(referencia) ?? new File(pasta(), referencia)).uri;
}

/**
 * Copia a foto (normalmente o arquivo temporário do picker) para a pasta do
 * app e devolve a referência (o nome do arquivo guardado) — é ela que vai para
 * a fila e para o rascunho do formulário.
 */
export async function salvarFoto(
  uri: string,
  mimeType: MimeTypeFoto = 'image/jpeg',
): Promise<string> {
  pasta().create({ intermediates: true, idempotent: true });
  const nome = novoNomeDeArquivo(mimeType);
  const destino = new File(pasta(), nome);
  try {
    await new File(uri).copy(destino);
  } catch (erro) {
    if (destino.exists) destino.delete();
    throw erro;
  }
  return nome;
}

/**
 * Conteúdo da foto em base64, sem prefixo `data:`. Lança `ErroFotoIndisponivel`
 * só quando o arquivo NÃO existe; qualquer outra falha de leitura sobe como
 * está (não é foto ausente: a ação continua na fila e tenta de novo).
 */
export async function lerFotoBase64(referencia: string): Promise<string> {
  const arquivo = arquivoDaFoto(referencia);
  if (arquivo === null || !arquivo.exists) throw new ErroFotoIndisponivel(referencia);
  return arquivo.base64();
}

/** A foto no formato do corpo da API; o mime sai da extensão que `salvarFoto` escolheu. */
export async function lerFotoParaEnvio(referencia: string): Promise<FotoBase64> {
  return {
    conteudoBase64: await lerFotoBase64(referencia),
    mimeType: mimeTypeDaReferencia(referencia),
  };
}

/** Apaga as fotos pedidas. Arquivo que já não existe não é erro; só se apaga dentro da pasta de fotos. */
export async function apagarFotos(referencias: readonly string[]): Promise<void> {
  for (const referencia of referencias) {
    const arquivo = arquivoDaFoto(referencia);
    if (arquivo?.exists) arquivo.delete();
  }
}

/** Esvazia a pasta de fotos (logout, troca de usuário). Sem pasta, não há o que fazer. */
export async function apagarTodasAsFotos(): Promise<void> {
  const diretorio = pasta();
  if (diretorio.exists) diretorio.delete();
}
