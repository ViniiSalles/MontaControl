import { CHAVE_SINCRONIZACAO } from '../chavesPersistidas';
import { criarSincronizacaoStore } from '../sincronizacaoStore';
import { armazenamentoEmMemoria } from './apoio';

describe('sincronizacaoStore', () => {
  it('começa online, ocioso, sem pendências, sem erro e sem última sincronização', () => {
    const store = criarSincronizacaoStore(armazenamentoEmMemoria().armazenamento);

    expect(store.getState()).toMatchObject({
      online: true,
      sincronizando: false,
      pendentes: 0,
      ultimaSincronizacaoEm: null,
      ultimoErro: null,
      avisosDescartados: [],
    });
  });

  it('persiste SÓ o instante da última sincronização', () => {
    const { dados, armazenamento } = armazenamentoEmMemoria();
    const store = criarSincronizacaoStore(armazenamento);

    store.setState({
      online: false,
      sincronizando: true,
      pendentes: 4,
      ultimoErro: 'sem_rede',
      avisosDescartados: ['Avaria recusada: X.'],
      ultimaSincronizacaoEm: 1_700_000_000_000,
    });

    const gravado = JSON.parse(dados.get(CHAVE_SINCRONIZACAO) as string);
    expect(gravado.state).toEqual({ ultimaSincronizacaoEm: 1_700_000_000_000 });
  });

  it('fechar e reabrir o app mantém a última sincronização e zera o resto', async () => {
    const { armazenamento } = armazenamentoEmMemoria();
    const aberta = criarSincronizacaoStore(armazenamento);
    aberta.setState({
      ultimaSincronizacaoEm: 1_700_000_000_000,
      pendentes: 3,
      ultimoErro: 'falha',
    });

    const reaberta = criarSincronizacaoStore(armazenamento);
    await reaberta.persist.rehydrate();

    expect(reaberta.getState()).toMatchObject({
      ultimaSincronizacaoEm: 1_700_000_000_000,
      pendentes: 0,
      ultimoErro: null,
      sincronizando: false,
      online: true,
    });
  });

  it('não hidrata sozinha: o estado salvo só entra quando o app manda (depois de saber de quem é o aparelho)', async () => {
    const { armazenamento } = armazenamentoEmMemoria();
    criarSincronizacaoStore(armazenamento).setState({ ultimaSincronizacaoEm: 123 });

    const reaberta = criarSincronizacaoStore(armazenamento);
    await Promise.resolve();

    expect(reaberta.getState().ultimaSincronizacaoEm).toBeNull();
  });

  it('valor salvo com tipo errado é ignorado', async () => {
    const { dados, armazenamento } = armazenamentoEmMemoria();
    dados.set(
      CHAVE_SINCRONIZACAO,
      JSON.stringify({ state: { ultimaSincronizacaoEm: 'ontem' }, version: 1 }),
    );
    const store = criarSincronizacaoStore(armazenamento);

    await store.persist.rehydrate();

    expect(store.getState().ultimaSincronizacaoEm).toBeNull();
  });

  it('dispensarAvisos esvazia os avisos', () => {
    const store = criarSincronizacaoStore(armazenamentoEmMemoria().armazenamento);
    store.setState({ avisosDescartados: ['a', 'b'] });

    store.getState().dispensarAvisos();

    expect(store.getState().avisosDescartados).toEqual([]);
  });

  it('reiniciar volta tudo ao inicial', () => {
    const store = criarSincronizacaoStore(armazenamentoEmMemoria().armazenamento);
    store.setState({ online: false, pendentes: 2, ultimaSincronizacaoEm: 5, ultimoErro: 'sessao' });

    store.getState().reiniciar();

    expect(store.getState()).toMatchObject({
      online: true,
      pendentes: 0,
      ultimaSincronizacaoEm: null,
      ultimoErro: null,
    });
  });
});
