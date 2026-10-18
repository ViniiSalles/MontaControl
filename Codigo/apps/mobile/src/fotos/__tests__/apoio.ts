import { Directory, File, Paths } from 'expo-file-system';

/** Foto como o picker a entrega: arquivo temporário no cache do app (sistema de arquivos em memória do jest-expo). */
export function criarFotoDoPicker(conteudo = 'foto', extensao = 'jpg'): string {
  const arquivo = new File(Paths.cache, `picker-${Math.random()}.${extensao}`);
  arquivo.create({ intermediates: true });
  arquivo.write(conteudo);
  return arquivo.uri;
}

/** Fotos guardadas pelo app agora (pasta de fotos de formulários e da fila). */
export function fotosGuardadas(): string[] {
  const pasta = new Directory(Paths.document, 'fotos_pendentes');
  return pasta.exists ? pasta.list().map((item) => item.uri) : [];
}
