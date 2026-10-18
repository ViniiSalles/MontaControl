import { File, Paths } from 'expo-file-system';
import {
  apagarFotos,
  apagarTodasAsFotos,
  ErroFotoIndisponivel,
  lerFotoBase64,
  lerFotoParaEnvio,
  mimeTypeSuportado,
  salvarFoto,
  uriDaFoto,
} from '../armazenamentoFotos';
import { base64DeTexto, existeFoto, fotosGuardadas } from './apoio';

/** Foto como o picker a entrega: um arquivo temporário no cache do app. */
function fotoDoPicker(nome: string, conteudo: string): string {
  const arquivo = new File(Paths.cache, nome);
  arquivo.create({ intermediates: true, overwrite: true });
  arquivo.write(conteudo);
  return arquivo.uri;
}

afterEach(async () => {
  jest.restoreAllMocks();
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
  it('copia a foto para a pasta do app e devolve só o NOME do arquivo (sem diretório)', async () => {
    const origem = fotoDoPicker('picker-1.jpg', 'conteudo-1');

    const nome = await salvarFoto(origem, 'image/jpeg');

    expect(nome).not.toContain('/');
    expect(nome).not.toBe(origem);
    expect(fotosGuardadas()).toEqual([nome]);
    expect(new File(uriDaFoto(nome)).textSync()).toBe('conteudo-1');
  });

  it('cada foto vai para um arquivo diferente, mesmo com origem repetida', async () => {
    const origem = fotoDoPicker('picker-2.jpg', 'x');

    const a = await salvarFoto(origem, 'image/jpeg');
    const b = await salvarFoto(origem, 'image/jpeg');

    expect(a).not.toBe(b);
    expect(fotosGuardadas()).toHaveLength(2);
  });

  it('a extensão segue o tipo da foto (png)', async () => {
    const nome = await salvarFoto(fotoDoPicker('picker-3.png', 'x'), 'image/png');

    expect(nome.endsWith('.png')).toBe(true);
  });

  it('origem inexistente falha sem deixar arquivo para trás', async () => {
    await expect(salvarFoto('file:///mock/cache/nao-existe.jpg', 'image/jpeg')).rejects.toThrow();

    expect(fotosGuardadas()).toEqual([]);
  });
});

describe('lerFotoBase64 / lerFotoParaEnvio', () => {
  it('converte o arquivo para base64 só na leitura', async () => {
    const nome = await salvarFoto(fotoDoPicker('picker-4.jpg', 'ola'), 'image/jpeg');

    expect(await lerFotoBase64(nome)).toBe(base64DeTexto('ola'));
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
    const nome = await salvarFoto(fotoDoPicker('picker-7.jpg', 'a'), 'image/jpeg');
    await apagarFotos([nome]);

    await expect(lerFotoBase64(nome)).rejects.toBeInstanceOf(ErroFotoIndisponivel);
    await expect(lerFotoParaEnvio(nome)).rejects.toBeInstanceOf(ErroFotoIndisponivel);
  });

  it('falha de leitura de um arquivo que EXISTE não vira "foto ausente": o erro real sobe', async () => {
    const nome = await salvarFoto(fotoDoPicker('picker-7b.jpg', 'a'), 'image/jpeg');
    jest.spyOn(File.prototype, 'base64').mockRejectedValue(new Error('disco com defeito'));

    const erro = await lerFotoBase64(nome).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(ErroFotoIndisponivel);
    expect((erro as Error).message).toBe('disco com defeito');
  });
});

describe('caminho guardado na fila (nome, ou caminho absoluto de versões anteriores)', () => {
  it('o nome relativo resolve na pasta atual', async () => {
    const nome = await salvarFoto(fotoDoPicker('picker-r.jpg', 'rel'), 'image/jpeg');

    expect(await lerFotoBase64(nome)).toBe(base64DeTexto('rel'));
    expect(uriDaFoto(nome)).toBe(new File(uriDaFoto(nome)).uri);
    expect(existeFoto(nome)).toBe(true);
  });

  it('caminho absoluto de outro container (iOS muda o prefixo no update/restore) ainda é lido e apagado', async () => {
    const nome = await salvarFoto(fotoDoPicker('picker-legado.jpg', 'legado'), 'image/jpeg');
    const absolutoAntigo = `file:///var/mobile/Containers/Data/Application/CONTAINER-ANTIGO/Documents/fotos_pendentes/${nome}`;

    expect(await lerFotoBase64(absolutoAntigo)).toBe(base64DeTexto('legado'));
    await apagarFotos([absolutoAntigo]);

    expect(existeFoto(nome)).toBe(false);
  });

  it('caminho absoluto do container atual (formato desta versão em desenvolvimento) também funciona', async () => {
    const nome = await salvarFoto(fotoDoPicker('picker-atual.jpg', 'atual'), 'image/jpeg');

    expect(await lerFotoBase64(uriDaFoto(nome))).toBe(base64DeTexto('atual'));
  });
});

describe('apagarFotos', () => {
  it('apaga só os pedidos', async () => {
    const a = await salvarFoto(fotoDoPicker('picker-8.jpg', 'a'), 'image/jpeg');
    const b = await salvarFoto(fotoDoPicker('picker-9.jpg', 'b'), 'image/jpeg');

    await apagarFotos([a]);

    expect(fotosGuardadas()).toEqual([b]);
  });

  it('arquivo que já não existe não é erro (apagar duas vezes, lista vazia)', async () => {
    const a = await salvarFoto(fotoDoPicker('picker-10.jpg', 'a'), 'image/jpeg');

    await apagarFotos([a]);
    await expect(apagarFotos([a, 'fantasma.jpg'])).resolves.toBeUndefined();
    await expect(apagarFotos([])).resolves.toBeUndefined();
  });

  it('nunca apaga arquivo fora da pasta de fotos (payload adulterado)', async () => {
    const alheio = fotoDoPicker('picker-11.jpg', 'importante');

    await apagarFotos([alheio, '../picker-11.jpg', '..', '.', '']);

    expect(new File(alheio).exists).toBe(true);
  });
});

describe('apagarTodasAsFotos', () => {
  it('esvazia a pasta inteira, inclusive fotos que nenhuma ação referencia', async () => {
    await salvarFoto(fotoDoPicker('picker-12.jpg', 'a'), 'image/jpeg');
    await salvarFoto(fotoDoPicker('picker-13.jpg', 'b'), 'image/jpeg');

    await apagarTodasAsFotos();

    expect(fotosGuardadas()).toEqual([]);
  });

  it('sem pasta (nada foi salvo ainda) não é erro', async () => {
    await apagarTodasAsFotos();

    await expect(apagarTodasAsFotos()).resolves.toBeUndefined();
  });

  it('a pasta é recriada no próximo salvamento', async () => {
    await salvarFoto(fotoDoPicker('picker-14.jpg', 'a'), 'image/jpeg');
    await apagarTodasAsFotos();

    const nome = await salvarFoto(fotoDoPicker('picker-15.jpg', 'b'), 'image/jpeg');

    expect(fotosGuardadas()).toEqual([nome]);
  });
});
