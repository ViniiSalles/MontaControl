import { act, renderHook } from '@testing-library/react-native';
import { apagarTodasAsFotos } from '../../fotos/armazenamentoFotos';
import { criarFotoDoPicker, existeFoto, fotosGuardadas } from '../../fotos/__tests__/apoio';
import { definirTokens } from '../../auth/tokenSessao';
import { useUiStore } from '../../estado/uiStore';
import { useRascunhoDeAvaria } from '../useRascunhoDeAvaria';

beforeEach(() => {
  useUiStore.getState().reiniciar();
  definirTokens({ accessToken: 'a', refreshToken: 'r' });
});

afterEach(async () => {
  definirTokens(null);
  await apagarTodasAsFotos();
});

describe('useRascunhoDeAvaria', () => {
  it('lê o rascunho do store: o que já estava lá aparece (reabrir a tela)', async () => {
    useUiStore.getState().alterarRascunhoAvaria({
      pedidoId: 4,
      campos: { pecaId: 9, tipoAvariaId: 2, descricao: 'Riscado' },
    });
    useUiStore.getState().anexarFotoAoRascunho('1-a.jpg');

    const { result } = await renderHook(() => useRascunhoDeAvaria());

    expect(result.current.pedidoEscolhido).toBe(4);
    expect(result.current.campos).toEqual({ pecaId: 9, tipoAvariaId: 2, descricao: 'Riscado' });
    expect(result.current.caminhos).toEqual(['1-a.jpg']);
  });

  it('escolher outro pedido zera a peça (ela pertence ao pedido)', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    await act(async () => {
      result.current.alterar('pecaId', 9);
      result.current.escolherPedido(4);
    });

    expect(result.current.pedidoEscolhido).toBe(4);
    expect(result.current.campos.pecaId).toBeNull();
  });

  it('alterar muda só o campo pedido e vai para o store', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());

    await act(async () => {
      result.current.alterar('descricao', 'Faltou parafuso');
      result.current.alterar('tipoAvariaId', 3);
    });

    expect(useUiStore.getState().rascunhoAvaria.campos).toEqual({
      pecaId: null,
      tipoAvariaId: 3,
      descricao: 'Faltou parafuso',
    });
  });

  it('adicionarFoto guarda o arquivo no app e põe o NOME no rascunho', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());

    await act(async () => {
      await result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
    });

    const [nome] = result.current.caminhos;
    expect(existeFoto(nome)).toBe(true);
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([nome]);
  });

  it('desmontar a tela NÃO apaga as fotos: o rascunho é o dono delas até o envio ou o descarte', async () => {
    const { result, unmount } = await renderHook(() => useRascunhoDeAvaria());
    await act(async () => {
      await result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
    });
    const [nome] = result.current.caminhos;

    await unmount();

    expect(existeFoto(nome)).toBe(true);
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([nome]);
  });

  it('foto que termina de ser guardada depois de a tela fechar entra no rascunho (não vira arquivo órfão)', async () => {
    const { result, unmount } = await renderHook(() => useRascunhoDeAvaria());
    const adicionando = result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
    await unmount();

    await adicionando;

    const [nome] = useUiStore.getState().rascunhoAvaria.fotos;
    expect(existeFoto(nome)).toBe(true);
    expect(fotosGuardadas()).toEqual([nome]);
  });

  it('foto que termina de ser guardada depois de a sessão acabar é apagada, não vai para o rascunho de quem entrar', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    const adicionando = result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
    // Logout e novo login enquanto a cópia acontece.
    definirTokens(null);
    definirTokens({ accessToken: 'b', refreshToken: 'r2' });

    await adicionando;

    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([]);
    expect(fotosGuardadas()).toEqual([]);
  });

  it('origem que não pode ser copiada rejeita e não suja o rascunho', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());

    await expect(
      act(async () => {
        await result.current.adicionarFoto('file:///mock/cache/nao-existe.jpg', 'image/jpeg');
      }),
    ).rejects.toThrow();

    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([]);
  });

  it('remover tira a foto do rascunho e apaga o arquivo', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    await act(async () => {
      await result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
      await result.current.adicionarFoto(criarFotoDoPicker('outra', 'png'), 'image/png');
    });
    const [primeira, segunda] = result.current.caminhos;

    await act(async () => {
      await result.current.remover(0);
    });

    expect(result.current.caminhos).toEqual([segunda]);
    expect(existeFoto(primeira)).toBe(false);
    expect(existeFoto(segunda)).toBe(true);
  });

  it('esquecerFotos zera a lista SEM apagar arquivos: a fila passou a ser a dona deles', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    await act(async () => {
      await result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
    });
    const [nome] = result.current.caminhos;

    await act(async () => {
      result.current.esquecerFotos();
    });

    expect(result.current.caminhos).toEqual([]);
    expect(existeFoto(nome)).toBe(true);
  });

  it('limparCampos zera os campos e mantém o pedido escolhido', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    await act(async () => {
      result.current.escolherPedido(4);
      result.current.alterar('descricao', 'x');
    });

    await act(async () => {
      result.current.limparCampos();
    });

    expect(result.current.campos).toEqual({ pecaId: null, tipoAvariaId: null, descricao: '' });
    expect(result.current.pedidoEscolhido).toBe(4);
  });

  it('descartar apaga os arquivos e esvazia o rascunho inteiro', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    await act(async () => {
      result.current.escolherPedido(4);
      result.current.alterar('descricao', 'x');
      await result.current.adicionarFoto(criarFotoDoPicker(), 'image/jpeg');
    });
    const [nome] = result.current.caminhos;

    await act(async () => {
      await result.current.descartar();
    });

    expect(existeFoto(nome)).toBe(false);
    expect(result.current.caminhos).toEqual([]);
    expect(result.current.campos.descricao).toBe('');
    expect(result.current.pedidoEscolhido).toBeNull();
  });

  it('temConteudo só é verdadeiro com algo digitado, escolhido ou fotografado (o pedido sozinho não conta)', async () => {
    const { result } = await renderHook(() => useRascunhoDeAvaria());
    expect(result.current.temConteudo).toBe(false);

    await act(async () => result.current.escolherPedido(4));
    expect(result.current.temConteudo).toBe(false);

    await act(async () => result.current.alterar('descricao', '  '));
    expect(result.current.temConteudo).toBe(false);

    await act(async () => result.current.alterar('descricao', 'Riscado'));
    expect(result.current.temConteudo).toBe(true);
  });
});
