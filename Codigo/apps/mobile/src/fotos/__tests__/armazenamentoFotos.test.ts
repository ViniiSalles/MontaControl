import { Directory, File, Paths } from 'expo-file-system';
import {
  apagarFotos,
  apagarTodasAsFotos,
  ErroFotoIndisponivel,
  lerFotoBase64,
  lerFotoParaEnvio,
  mimeTypeSuportado,
  salvarFoto,
} from '../armazenamentoFotos';
import { base64DeTexto } from './apoio';

/** Foto como o picker a entrega: um arquivo temporário no cache do app. */
function fotoDoPicker(nome: string, conteudo: string): string {
  const arquivo = new File(Paths.cache, nome);
  arquivo.create({ intermediates: true, overwrite: true });
  arquivo.write(conteudo);
  return arquivo.uri;
}

function arquivosGuardados(): string[] {
  const pasta = new Directory(Paths.document, 'fotos_pendentes');
  return pasta.exists ? pasta.list().map((item) => item.uri) : [];
}

afterEach(async () => {
  await apagarTodasAsFotos();
});

describe('mimeTypeSuportado', () => {
  it('aceita JPEG e PNG, nada além disso (HEIC, ausente)', () => {
    expect(mimeTypeSuportado('image/jpeg')).toBe('image/jpeg');
    expect(mimeTypeSuportado('image/png')).toBe('image/png');
    expect(mimeTypeSuportado('image/heic')).toBeNull();
    expect(mimeTypeSuportado(undefined)).toBeNull();
    expect(mimeTypeSuportado(null)).toBeNull();
  });
});

describe('salvarFoto', () => {
  it('copia a foto para a pasta do app e devolve o caminho do arquivo guardado', async () => {
    const origem = fotoDoPicker('picker-1.jpg', 'conteudo-1');

    const caminho = await salvarFoto(origem, 'image/jpeg');

    expect(caminho).not.toBe(origem);
    expect(arquivosGuardados()).toEqual([caminho]);
    expect(new File(caminho).exists).toBe(true);
    expect(new File(caminho).textSync()).toBe('conteudo-1');
  });

  it('cada foto vai para um arquivo diferente, mesmo com origem repetida', async () => {
    const origem = fotoDoPicker('picker-2.jpg', 'x');

    const a = await salvarFoto(origem, 'image/jpeg');
    const b = await salvarFoto(origem, 'image/jpeg');

    expect(a).not.toBe(b);
    expect(arquivosGuardados()).toHaveLength(2);
  });

  it('a extensão segue o tipo da foto (png)', async () => {
    const caminho = await salvarFoto(fotoDoPicker('picker-3.png', 'x'), 'image/png');

    expect(caminho.endsWith('.png')).toBe(true);
  });

  it('origem inexistente falha sem deixar arquivo para trás', async () => {
    await expect(salvarFoto('file:///mock/cache/nao-existe.jpg', 'image/jpeg')).rejects.toThrow();

    expect(arquivosGuardados()).toEqual([]);
  });
});

describe('lerFotoBase64 / lerFotoParaEnvio', () => {
  it('converte o arquivo para base64 só na leitura', async () => {
    const caminho = await salvarFoto(fotoDoPicker('picker-4.jpg', 'ola'), 'image/jpeg');

    expect(await lerFotoBase64(caminho)).toBe(base64DeTexto('ola'));
  });

  it('lerFotoParaEnvio monta o formato da API com o mime vindo da extensão', async () => {
    const jpeg = await salvarFoto(fotoDoPicker('picker-5.jpg', 'a'), 'image/jpeg');
    const png = await salvarFoto(fotoDoPicker('picker-6.png', 'b'), 'image/png');

    expect(await lerFotoParaEnvio(jpeg)).toEqual({
      conteudoBase64: base64DeTexto('a'),
      mimeType: 'image/jpeg',
    });
    expect(await lerFotoParaEnvio(png)).toEqual({
      conteudoBase64: base64DeTexto('b'),
      mimeType: 'image/png',
    });
  });

  it('arquivo que não existe mais vira ErroFotoIndisponivel', async () => {
    const caminho = await salvarFoto(fotoDoPicker('picker-7.jpg', 'a'), 'image/jpeg');
    await apagarFotos([caminho]);

    await expect(lerFotoBase64(caminho)).rejects.toBeInstanceOf(ErroFotoIndisponivel);
    await expect(lerFotoParaEnvio(caminho)).rejects.toBeInstanceOf(ErroFotoIndisponivel);
  });
});

describe('apagarFotos', () => {
  it('apaga só os caminhos pedidos', async () => {
    const a = await salvarFoto(fotoDoPicker('picker-8.jpg', 'a'), 'image/jpeg');
    const b = await salvarFoto(fotoDoPicker('picker-9.jpg', 'b'), 'image/jpeg');

    await apagarFotos([a]);

    expect(arquivosGuardados()).toEqual([b]);
  });

  it('arquivo que já não existe não é erro (apagar duas vezes, lista vazia)', async () => {
    const a = await salvarFoto(fotoDoPicker('picker-10.jpg', 'a'), 'image/jpeg');

    await apagarFotos([a]);
    await expect(
      apagarFotos([a, 'file:///mock/document/fotos_pendentes/fantasma.jpg']),
    ).resolves.toBeUndefined();
    await expect(apagarFotos([])).resolves.toBeUndefined();
  });

  it('nunca apaga arquivo fora da pasta de fotos (payload adulterado)', async () => {
    const alheio = fotoDoPicker('picker-11.jpg', 'importante');

    await apagarFotos([alheio]);

    expect(new File(alheio).exists).toBe(true);
  });
});

describe('apagarTodasAsFotos', () => {
  it('esvazia a pasta inteira, inclusive fotos que nenhuma ação referencia', async () => {
    await salvarFoto(fotoDoPicker('picker-12.jpg', 'a'), 'image/jpeg');
    await salvarFoto(fotoDoPicker('picker-13.jpg', 'b'), 'image/jpeg');

    await apagarTodasAsFotos();

    expect(arquivosGuardados()).toEqual([]);
  });

  it('sem pasta (nada foi salvo ainda) não é erro', async () => {
    await apagarTodasAsFotos();

    await expect(apagarTodasAsFotos()).resolves.toBeUndefined();
  });

  it('a pasta é recriada no próximo salvamento', async () => {
    await salvarFoto(fotoDoPicker('picker-14.jpg', 'a'), 'image/jpeg');
    await apagarTodasAsFotos();

    const caminho = await salvarFoto(fotoDoPicker('picker-15.jpg', 'b'), 'image/jpeg');

    expect(arquivosGuardados()).toEqual([caminho]);
  });
});
