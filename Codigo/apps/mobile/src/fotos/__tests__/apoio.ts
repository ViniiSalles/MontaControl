import { Directory, File, Paths } from 'expo-file-system';
import { uriDaFoto } from '../armazenamentoFotos';

/** Foto como o picker a entrega: arquivo temporário no cache do app (sistema de arquivos em memória do jest-expo). */
export function criarFotoDoPicker(conteudo = 'foto', extensao = 'jpg'): string {
  const arquivo = new File(Paths.cache, `picker-${Math.random()}.${extensao}`);
  arquivo.create({ intermediates: true });
  arquivo.write(conteudo);
  return arquivo.uri;
}

/** Nomes dos arquivos guardados pelo app agora (pasta de fotos de formulários e da fila). */
export function fotosGuardadas(): string[] {
  const pasta = new Directory(Paths.document, 'fotos_pendentes');
  return pasta.exists ? pasta.list().map((item) => item.uri.split('/').pop() ?? item.uri) : [];
}

/** A foto (nome guardado no payload/rascunho) ainda existe no aparelho? */
export function existeFoto(nome: string): boolean {
  return new File(uriDaFoto(nome)).exists;
}

/** Apaga o arquivo da foto direto, sem passar pelo módulo (simula o arquivo que sumiu). */
export function sumirComFoto(nome: string): void {
  new File(uriDaFoto(nome)).delete();
}

/** Base64 de um texto ASCII — o que `lerFotoBase64` deve devolver para a foto criada com esse conteúdo. */
export function base64DeTexto(texto: string): string {
  return (globalThis as unknown as { btoa: (texto: string) => string }).btoa(texto);
}
