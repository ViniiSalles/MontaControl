import { CHAVE_UI } from '../chavesPersistidas';
import { criarUiStore } from '../uiStore';
import { armazenamentoEmMemoria } from './apoio';

function abrir(armazenamento = armazenamentoEmMemoria().armazenamento) {
  return criarUiStore(armazenamento);
}

describe('uiStore', () => {
  it('começa sem obra e com rascunho de avaria vazio', () => {
    expect(abrir().getState()).toMatchObject({
      obraEscolhidaId: null,
      rascunhoAvaria: {
        pedidoId: null,
        campos: { pecaId: null, tipoAvariaId: null, descricao: '' },
        fotos: [],
      },
    });
  });

  it('fechar e reabrir o app mantém a obra escolhida e o rascunho (campos e nomes das fotos)', async () => {
    const { armazenamento } = armazenamentoEmMemoria();
    const aberta = abrir(armazenamento);
    aberta.getState().escolherObra(12);
    aberta.getState().alterarRascunhoAvaria({
      pedidoId: 12,
      campos: { pecaId: 5, tipoAvariaId: 2, descricao: 'Porta riscada' },
    });
    aberta.getState().anexarFotoAoRascunho('1-1-a.jpg');
    aberta.getState().anexarFotoAoRascunho('2-2-b.png');

    const reaberta = abrir(armazenamento);
    await reaberta.persist.rehydrate();

    expect(reaberta.getState().obraEscolhidaId).toBe(12);
    expect(reaberta.getState().rascunhoAvaria).toEqual({
      pedidoId: 12,
      campos: { pecaId: 5, tipoAvariaId: 2, descricao: 'Porta riscada' },
      fotos: ['1-1-a.jpg', '2-2-b.png'],
    });
  });

  it('só dados de tela vão para o disco (nada de usuário, nome ou e-mail)', () => {
    const { dados, armazenamento } = armazenamentoEmMemoria();
    const store = abrir(armazenamento);

    store.getState().escolherObra(3);

    const gravado = JSON.parse(dados.get(CHAVE_UI) as string);
    expect(Object.keys(gravado.state).sort()).toEqual(['obraEscolhidaId', 'rascunhoAvaria']);
  });

  it('anexar a mesma foto duas vezes não duplica; remover tira só a pedida', () => {
    const store = abrir();
    store.getState().anexarFotoAoRascunho('a.jpg');
    store.getState().anexarFotoAoRascunho('a.jpg');
    store.getState().anexarFotoAoRascunho('b.jpg');
    expect(store.getState().rascunhoAvaria.fotos).toEqual(['a.jpg', 'b.jpg']);

    store.getState().removerFotoDoRascunho('a.jpg');

    expect(store.getState().rascunhoAvaria.fotos).toEqual(['b.jpg']);
  });

  it('soltarFotosDoRascunho zera a lista e mantém os campos', () => {
    const store = abrir();
    store
      .getState()
      .alterarRascunhoAvaria({ campos: { pecaId: 1, tipoAvariaId: 1, descricao: 'x' } });
    store.getState().anexarFotoAoRascunho('a.jpg');

    store.getState().soltarFotosDoRascunho();

    expect(store.getState().rascunhoAvaria.fotos).toEqual([]);
    expect(store.getState().rascunhoAvaria.campos.descricao).toBe('x');
  });

  it('limparRascunhoAvaria volta ao vazio sem mexer na obra', () => {
    const store = abrir();
    store.getState().escolherObra(9);
    store.getState().alterarRascunhoAvaria({ pedidoId: 9 });
    store.getState().anexarFotoAoRascunho('a.jpg');

    store.getState().limparRascunhoAvaria();

    expect(store.getState().rascunhoAvaria.pedidoId).toBeNull();
    expect(store.getState().rascunhoAvaria.fotos).toEqual([]);
    expect(store.getState().obraEscolhidaId).toBe(9);
  });

  it('reiniciar apaga obra e rascunho', () => {
    const store = abrir();
    store.getState().escolherObra(9);
    store.getState().anexarFotoAoRascunho('a.jpg');

    store.getState().reiniciar();

    expect(store.getState().obraEscolhidaId).toBeNull();
    expect(store.getState().rascunhoAvaria.fotos).toEqual([]);
  });

  it('conteúdo salvo malformado é descartado campo a campo, sem derrubar o app', async () => {
    const { dados, armazenamento } = armazenamentoEmMemoria();
    dados.set(
      CHAVE_UI,
      JSON.stringify({
        state: {
          obraEscolhidaId: 'doze',
          rascunhoAvaria: {
            pedidoId: 4,
            campos: { pecaId: 'x', tipoAvariaId: 2, descricao: 42 },
            fotos: ['ok.jpg', 7, null],
          },
        },
        version: 1,
      }),
    );
    const store = abrir(armazenamento);

    await store.persist.rehydrate();

    expect(store.getState().obraEscolhidaId).toBeNull();
    expect(store.getState().rascunhoAvaria).toEqual({
      pedidoId: 4,
      campos: { pecaId: null, tipoAvariaId: 2, descricao: '' },
      fotos: ['ok.jpg'],
    });
  });

  it('JSON ilegível no disco vira estado inicial', async () => {
    const { dados, armazenamento } = armazenamentoEmMemoria();
    dados.set(CHAVE_UI, '{não é json');
    const store = abrir(armazenamento);

    await store.persist.rehydrate();

    expect(store.getState().obraEscolhidaId).toBeNull();
  });
});
