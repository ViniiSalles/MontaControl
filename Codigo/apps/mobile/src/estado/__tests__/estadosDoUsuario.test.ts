import { createJSONStorage } from 'zustand/middleware';
import { CHAVE_SINCRONIZACAO, CHAVE_UI } from '../chavesPersistidas';
import {
  descartarEstadosDaReplica,
  descartarEstadosDoUsuario,
  reidratarEstadosPersistidos,
} from '../estadosDoUsuario';
import { useSincronizacaoStore } from '../sincronizacaoStore';
import { useUiStore } from '../uiStore';
import { armazenamentoEmMemoria } from './apoio';

// Os singletons do app guardam no banco real (SQLite, indisponível no Jest): troca
// o armazenamento por um em memória, o "disco" que sobrevive a fechar o app.
let disco: ReturnType<typeof armazenamentoEmMemoria>;

function preencherEstados() {
  useUiStore.getState().escolherObra(12);
  useUiStore.getState().alterarRascunhoAvaria({
    pedidoId: 12,
    campos: { pecaId: 5, tipoAvariaId: 2, descricao: 'Porta riscada' },
  });
  useUiStore.getState().anexarFotoAoRascunho('1-a.jpg');
  useSincronizacaoStore.setState({
    ultimaSincronizacaoEm: 1_700_000_000_000,
    pendentes: 2,
    avisosDescartados: ['Avaria recusada: X.'],
  });
}

beforeEach(() => {
  disco = armazenamentoEmMemoria();
  const storage = createJSONStorage(() => disco.armazenamento);
  useUiStore.persist.setOptions({ storage });
  useSincronizacaoStore.persist.setOptions({ storage });
  useUiStore.getState().reiniciar();
  useSincronizacaoStore.getState().reiniciar();
  disco.dados.clear();
});

describe('descartarEstadosDoUsuario (logout explícito, troca de usuário, perfil recusado)', () => {
  it('zera na hora a memória dos dois stores', async () => {
    preencherEstados();

    const terminou = descartarEstadosDoUsuario();

    // Antes de qualquer await: a tela nunca mostra o estado do usuário anterior.
    expect(useUiStore.getState().obraEscolhidaId).toBeNull();
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([]);
    expect(useUiStore.getState().rascunhoAvaria.campos.descricao).toBe('');
    expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).toBeNull();
    expect(useSincronizacaoStore.getState().avisosDescartados).toEqual([]);
    await terminou;
  });

  it('apaga as chaves do disco (não basta zerar a memória: o próximo boot leria de volta)', async () => {
    preencherEstados();
    expect(disco.dados.has(CHAVE_UI)).toBe(true);
    expect(disco.dados.has(CHAVE_SINCRONIZACAO)).toBe(true);

    await descartarEstadosDoUsuario();

    expect(disco.dados.has(CHAVE_UI)).toBe(false);
    expect(disco.dados.has(CHAVE_SINCRONIZACAO)).toBe(false);
  });

  it('um app reaberto depois não encontra nada do usuário anterior', async () => {
    preencherEstados();
    await descartarEstadosDoUsuario();

    useUiStore.getState().reiniciar();
    await reidratarEstadosPersistidos();

    expect(useUiStore.getState().obraEscolhidaId).toBeNull();
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([]);
  });

  it('nunca rejeita, mesmo com o disco falhando', async () => {
    preencherEstados();
    jest.spyOn(disco.armazenamento, 'removeItem').mockImplementation(() => {
      throw new Error('disco');
    });

    await expect(descartarEstadosDoUsuario()).resolves.toBeUndefined();
  });
});

describe('descartarEstadosDaReplica (expiração forçada: a fila e o dono ficam)', () => {
  it('zera o status da sincronização (memória e disco) e MANTÉM obra e rascunho do mesmo usuário', async () => {
    preencherEstados();

    await descartarEstadosDaReplica();

    expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).toBeNull();
    expect(useSincronizacaoStore.getState().pendentes).toBe(0);
    expect(disco.dados.has(CHAVE_SINCRONIZACAO)).toBe(false);
    expect(useUiStore.getState().obraEscolhidaId).toBe(12);
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual(['1-a.jpg']);
    expect(disco.dados.has(CHAVE_UI)).toBe(true);
  });
});

describe('reidratarEstadosPersistidos', () => {
  it('traz do disco a obra, o rascunho e a última sincronização', async () => {
    preencherEstados();
    // "Fechar o app": a memória some, o disco fica como estava.
    const noDisco = new Map(disco.dados);
    useUiStore.getState().reiniciar();
    useSincronizacaoStore.getState().reiniciar();
    disco.dados.clear();
    noDisco.forEach((valor, chave) => disco.dados.set(chave, valor));

    await reidratarEstadosPersistidos();

    expect(useUiStore.getState().obraEscolhidaId).toBe(12);
    expect(useUiStore.getState().rascunhoAvaria.campos.descricao).toBe('Porta riscada');
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual(['1-a.jpg']);
    expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).toBe(1_700_000_000_000);
  });

  it('nunca rejeita, mesmo com o disco falhando', async () => {
    jest.spyOn(disco.armazenamento, 'getItem').mockImplementation(() => {
      throw new Error('disco');
    });

    await expect(reidratarEstadosPersistidos()).resolves.toBeUndefined();
  });
});
