import { localStorageKey } from '@nozbe/watermelondb';
import { getLastPulledAt } from '@nozbe/watermelondb/sync/impl';
import { syncPullFixture, TABELAS_SYNC } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { executarSincronizacao } from '../../sincronizacao/syncManager';
import { AcaoPendente } from '../AcaoPendente';
import { registrarDonoNoBanco, lerDonoNoBanco } from '../donoDaFila';
import { limparEspelhoLocal } from '../limparEspelho';
import { criarAcaoPendente, criarBancoDeTeste } from './apoio';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
});

async function bancoComReplicaSincronizadaEFila() {
  const database = criarBancoDeTeste();
  fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
  await executarSincronizacao(database);
  await criarAcaoPendente(database, {
    tipo: 'checkin',
    idCliente: 'id-1',
    payload: {},
  });
  return database;
}

// Expiração forçada da sessão (refresh recusado): a réplica do servidor some, mas
// a fila de ações (ainda não enviadas) fica — são marcações do montador.
describe('limparEspelhoLocal', () => {
  it('apaga todas as tabelas da réplica e preserva as ações pendentes', async () => {
    const database = await bancoComReplicaSincronizadaEFila();
    for (const tabela of TABELAS_SYNC) {
      const { created, updated } = syncPullFixture.changes[tabela];
      expect(await database.get(tabela).query().fetchCount()).toBe(created.length + updated.length);
    }

    await limparEspelhoLocal(database);

    for (const tabela of TABELAS_SYNC) {
      expect(await database.get(tabela).query().fetchCount()).toBe(0);
    }
    const pendentes = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].idCliente).toBe('id-1');
  });

  it('zera o lastPulledAt: o próximo usuário não faz pull incremental em cima de réplica apagada', async () => {
    const database = await bancoComReplicaSincronizadaEFila();
    expect(await getLastPulledAt(database)).toBe(syncPullFixture.timestamp);

    await limparEspelhoLocal(database);

    expect(await getLastPulledAt(database)).toBeNull();
    // E o pull seguinte é completo (sem lastPulledAt) e repopula a réplica.
    // (a ação preservada na fila sobe antes do pull: roteia por URL)
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/sync/pull')
        ? respostaJson(200, syncPullFixture)
        : respostaJson(201, {}),
    );
    await executarSincronizacao(database);
    const chamadaDoPull = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/sync/pull'))!;
    expect(new URL(String(chamadaDoPull[0])).searchParams.has('lastPulledAt')).toBe(false);
    expect(await database.get('pedidos').query().fetchCount()).toBe(1);
  });

  it('o wipe completo do logout também zera o lastPulledAt', async () => {
    const database = await bancoComReplicaSincronizadaEFila();

    await database.write(() => database.unsafeResetDatabase());

    expect(await getLastPulledAt(database)).toBeNull();
    expect(await database.get('pedidos').query().fetchCount()).toBe(0);
  });

  it('apaga também as cópias de obra legadas do app v2 (dado pessoal do cliente)', async () => {
    const database = criarBancoDeTeste();
    await database.localStorage.set(localStorageKey<unknown>('obras_do_montador'), [{ nome: 'Maria' }]);
    await database.localStorage.set(localStorageKey<number>('obra_da_jornada_aberta'), 10);

    await limparEspelhoLocal(database);

    expect(await database.localStorage.get('obras_do_montador')).toBeUndefined();
    expect(await database.localStorage.get('obra_da_jornada_aberta')).toBeUndefined();
  });

  it('não mexe em chaves de localStorage que não são da réplica (nem no dono da fila)', async () => {
    const database = criarBancoDeTeste();
    const chave = localStorageKey<string>('outra_chave');
    await database.localStorage.set(chave, 'valor');
    await registrarDonoNoBanco(database, 7);

    await limparEspelhoLocal(database);

    expect(await database.localStorage.get(chave)).toBe('valor');
    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'dono', usuarioId: 7 });
  });
});
