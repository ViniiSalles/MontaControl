import { act, renderHook } from '@testing-library/react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { apagarTodasAsFotos } from '../armazenamentoFotos';
import { useFotosDoFormulario } from '../useFotosDoFormulario';

/** Foto como o picker a entrega: arquivo temporário no cache do app. */
function fotoDoPicker(): string {
  const arquivo = new File(Paths.cache, `picker-${Math.random()}.jpg`);
  arquivo.create({ intermediates: true });
  arquivo.write('foto');
  return arquivo.uri;
}

const existe = (caminho: string) => new File(caminho).exists;

afterEach(async () => {
  await apagarTodasAsFotos();
});

describe('useFotosDoFormulario', () => {
  it('adicionar guarda a foto como arquivo do app e devolve o caminho na lista', async () => {
    const { result } = await renderHook(() => useFotosDoFormulario());
    const origem = fotoDoPicker();

    await act(async () => {
      await result.current.adicionar(origem, 'image/jpeg');
    });

    expect(result.current.caminhos).toHaveLength(1);
    expect(result.current.caminhos[0]).not.toBe(origem);
    expect(existe(result.current.caminhos[0])).toBe(true);
  });

  it('remover tira a foto da lista e apaga o arquivo', async () => {
    const { result } = await renderHook(() => useFotosDoFormulario());
    await act(async () => {
      await result.current.adicionar(fotoDoPicker(), 'image/jpeg');
      await result.current.adicionar(fotoDoPicker(), 'image/png');
    });
    const [primeira, segunda] = result.current.caminhos;

    await act(async () => {
      await result.current.remover(0);
    });

    expect(result.current.caminhos).toEqual([segunda]);
    expect(existe(primeira)).toBe(false);
    expect(existe(segunda)).toBe(true);
  });

  it('esquecer zera a lista SEM apagar os arquivos: a fila passou a ser a dona deles', async () => {
    const { result } = await renderHook(() => useFotosDoFormulario());
    await act(async () => {
      await result.current.adicionar(fotoDoPicker(), 'image/jpeg');
    });
    const [caminho] = result.current.caminhos;

    await act(async () => {
      result.current.esquecer();
    });

    expect(result.current.caminhos).toEqual([]);
    expect(existe(caminho)).toBe(true);
  });

  it('desmontar com fotos que nunca foram enviadas apaga os arquivos (nada de documento órfão no aparelho)', async () => {
    const { result, unmount } = await renderHook(() => useFotosDoFormulario());
    await act(async () => {
      await result.current.adicionar(fotoDoPicker(), 'image/jpeg');
    });
    const [caminho] = result.current.caminhos;

    await unmount();

    expect(existe(caminho)).toBe(false);
  });

  it('desmontar depois de esquecer mantém os arquivos', async () => {
    const { result, unmount } = await renderHook(() => useFotosDoFormulario());
    await act(async () => {
      await result.current.adicionar(fotoDoPicker(), 'image/jpeg');
    });
    const [caminho] = result.current.caminhos;
    await act(async () => {
      result.current.esquecer();
    });

    await unmount();

    expect(existe(caminho)).toBe(true);
  });

  it('foto que termina de ser guardada depois do desmontar é apagada na hora', async () => {
    const { result, unmount } = await renderHook(() => useFotosDoFormulario());
    const adicionando = result.current.adicionar(fotoDoPicker(), 'image/jpeg');
    await unmount();

    await adicionando;

    const pasta = new Directory(Paths.document, 'fotos_pendentes');
    expect(pasta.exists ? pasta.list() : []).toEqual([]);
  });

  it('origem que não pode ser copiada rejeita e não deixa a lista suja', async () => {
    const { result } = await renderHook(() => useFotosDoFormulario());

    await expect(
      act(async () => {
        await result.current.adicionar('file:///mock/cache/nao-existe.jpg', 'image/jpeg');
      }),
    ).rejects.toThrow();

    expect(result.current.caminhos).toEqual([]);
  });
});
