import { Q } from '@nozbe/watermelondb';
import { getLastPulledAt } from '@nozbe/watermelondb/sync/impl';
import { StatusJornada, SYNC_SCHEMA_VERSION, TABELAS_SYNC, syncPullFixture } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarAcaoPendente, criarBancoDeTeste, pullSemMudancas } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { Pedido } from '../../db/Pedido';
import { lerJornadasComPendentes } from '../../jornada/jornadasComPendentes';
import { executarSincronizacao } from '../syncManager';
import {
  lerStatusDaSincronizacao,
  reiniciarStatusDaSincronizacao,
} from '../statusDaSincronizacao';

jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

/** Check-in feito offline que o fixture traz como a jornada 502 (mesmo `checkin_id_cliente`). */
const ID_CLIENTE_CHECKIN_502 = '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a03';

const JORNADA_502_DO_SERVIDOR: JornadaDTO = {
  id: 502,
  usuarioId: 7,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-10-16T11:00:03.000Z',
  checkinLatitude: -19.9191002,
  checkinLongitude: -43.9386399,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-10-16T11:30:20.000Z',
};

function urlsChamadas(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  reiniciarStatusDaSincronizacao();
});

describe('executarSincronizacao — pull pelo synchronize()', () => {
  it('1º pull (sem lastPulledAt) popula todas as tabelas a partir do fixture', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));

    await executarSincronizacao(database);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(urlsChamadas()[0]);
    expect(url.pathname).toBe('/api/sync/pull');
    expect(url.searchParams.get('schemaVersion')).toBe(String(SYNC_SCHEMA_VERSION));
    expect(url.searchParams.has('lastPulledAt')).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token');

    for (const tabela of TABELAS_SYNC) {
      const { created, updated } = syncPullFixture.changes[tabela];
      expect(await database.get(tabela).query().fetchCount()).toBe(created.length + updated.length);
    }
    expect(await getLastPulledAt(database)).toBe(syncPullFixture.timestamp);
    expect(lerStatusDaSincronizacao()).toMatchObject({ sincronizando: false, ultimoErro: null });
  });

  it('o 2º pull manda o lastPulledAt do anterior (incremental)', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    await executarSincronizacao(database);
    fetchMock.mockResolvedValueOnce(respostaJson(200, pullSemMudancas(syncPullFixture.timestamp + 60_000)));

    await executarSincronizacao(database);

    const url = new URL(urlsChamadas()[1]);
    expect(url.searchParams.get('lastPulledAt')).toBe(String(syncPullFixture.timestamp));
    expect(await getLastPulledAt(database)).toBe(syncPullFixture.timestamp + 60_000);
  });

  it('pedido desalocado no servidor (em deleted) some da réplica depois do pull', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    await executarSincronizacao(database);
    expect(await database.get<Pedido>('pedidos').query(Q.where('id', '12')).fetchCount()).toBe(1);

    const incremental = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    incremental.changes.pedidos.deleted = ['12'];
    incremental.changes.ambientes.deleted = ['30', '31'];
    fetchMock.mockResolvedValueOnce(respostaJson(200, incremental));
    await executarSincronizacao(database);

    expect(await database.get<Pedido>('pedidos').query().fetchCount()).toBe(0);
    expect(await database.get('ambientes').query().fetchCount()).toBe(0);
  });

  it('linha atualizada pelo servidor sobrescreve a da réplica (mesmo id), sem duplicar', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    await executarSincronizacao(database);

    const incremental = pullSemMudancas(syncPullFixture.timestamp + 60_000);
    incremental.changes.pedidos.updated = [
      { ...syncPullFixture.changes.pedidos.updated[0], cliente_nome: 'Residencial Acácias II' },
    ];
    fetchMock.mockResolvedValueOnce(respostaJson(200, incremental));
    await executarSincronizacao(database);

    const pedidos = await database.get<Pedido>('pedidos').query().fetch();
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].clienteNome).toBe('Residencial Acácias II');
  });
});

describe('executarSincronizacao — fila e pull juntos', () => {
  it('check-in da fila: depois do envio e do pull existe UMA jornada, e a fila fica vazia', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: ID_CLIENTE_CHECKIN_502,
      payload: {
        idCliente: ID_CLIENTE_CHECKIN_502,
        latitude: -19.9191002,
        longitude: -43.9386399,
        registradoEm: '2026-10-16T11:00:03.000Z',
        pedidoId: 12,
      },
    });
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/jornadas/checkin')
        ? respostaJson(201, JORNADA_502_DO_SERVIDOR)
        : respostaJson(200, syncPullFixture),
    );

    // Offline, antes de qualquer sincronização: a marcação já aparece (sobreposição).
    expect(
      (await lerJornadasComPendentes(database)).filter(
        (j) => j.checkinIdCliente === ID_CLIENTE_CHECKIN_502,
      ),
    ).toHaveLength(1);

    await executarSincronizacao(database);

    // O envio sai ANTES do pull.
    expect(urlsChamadas()[0]).toContain('/api/jornadas/checkin');
    expect(urlsChamadas()[1]).toContain('/api/sync/pull');

    const doCheckin = (await lerJornadasComPendentes(database)).filter(
      (j) => j.checkinIdCliente === ID_CLIENTE_CHECKIN_502,
    );
    expect(doCheckin).toHaveLength(1);
    expect(doCheckin[0].id).toBe(502); // a da réplica, não a provisória
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(0);
  });

  it('envio ok mas pull falha: a ação fica "enviada" e a tela continua com UMA jornada', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: ID_CLIENTE_CHECKIN_502,
      payload: {
        idCliente: ID_CLIENTE_CHECKIN_502,
        latitude: -19.9191002,
        longitude: -43.9386399,
        registradoEm: '2026-10-16T11:00:03.000Z',
        pedidoId: 12,
      },
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/jornadas/checkin')) return respostaJson(201, JORNADA_502_DO_SERVIDOR);
      throw new TypeError('Network request failed');
    });

    await executarSincronizacao(database);

    const fila = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(fila).toHaveLength(1);
    expect(fila[0].status).toBe('enviada');
    // Nada de "pendente" para o selo de aguardando envio.
    expect(
      await database.get<AcaoPendente>('acoes_pendentes').query(Q.where('status', 'pendente')).fetchCount(),
    ).toBe(0);
    const jornadas = await lerJornadasComPendentes(database);
    expect(jornadas).toHaveLength(1);
    expect(jornadas[0].status).toBe(StatusJornada.EM_ANDAMENTO);
    expect(lerStatusDaSincronizacao().ultimoErro).toBe('sem_rede');

    // Quando a rede volta, o pull traz a jornada e a "enviada" é apagada.
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(respostaJson(200, syncPullFixture));
    await executarSincronizacao(database);

    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(0);
    expect(
      (await lerJornadasComPendentes(database)).filter((j) => j.checkinIdCliente === ID_CLIENTE_CHECKIN_502),
    ).toHaveLength(1);
  });

  it('ação pendente que não conseguiu subir segue pendente e continua sobreposta', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-offline',
      payload: {
        idCliente: 'checkin-offline',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: '2026-10-17T11:00:00.000Z',
        pedidoId: 12,
      },
    });
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await executarSincronizacao(database);

    const fila = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(fila.map((a) => a.status)).toEqual(['pendente']);
    expect(await lerJornadasComPendentes(database)).toHaveLength(1);
  });
});

describe('executarSincronizacao — falhas', () => {
  it('426 (app desatualizado): estado claro, nada gravado, sem lançar nem repetir', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(
      respostaJson(426, {
        codigo: 'VERSAO_SCHEMA_INCOMPATIVEL',
        message: 'Atualize o aplicativo.',
      }),
    );

    await expect(executarSincronizacao(database)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lerStatusDaSincronizacao()).toMatchObject({
      sincronizando: false,
      ultimoErro: 'versao_incompativel',
    });
    expect(await getLastPulledAt(database)).toBeNull();
    expect(await database.get('pedidos').query().fetchCount()).toBe(0);
  });

  it('sem rede: ultimoErro sem_rede e lastPulledAt intacto', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await executarSincronizacao(database);

    expect(lerStatusDaSincronizacao().ultimoErro).toBe('sem_rede');
    expect(await getLastPulledAt(database)).toBeNull();
  });

  it('5xx do servidor: sem_rede (tenta de novo no próximo gatilho)', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockResolvedValue(respostaJson(503, { codigo: 'INDISPONIVEL', message: 'fora do ar' }));

    await executarSincronizacao(database);

    expect(lerStatusDaSincronizacao().ultimoErro).toBe('sem_rede');
  });

  it('um pull bem-sucedido limpa o erro anterior', async () => {
    const database = criarBancoDeTeste();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await executarSincronizacao(database);
    expect(lerStatusDaSincronizacao().ultimoErro).toBe('sem_rede');

    fetchMock.mockResolvedValueOnce(respostaJson(200, syncPullFixture));
    await executarSincronizacao(database);

    expect(lerStatusDaSincronizacao().ultimoErro).toBeNull();
    expect(lerStatusDaSincronizacao().ultimaSincronizacaoEm).not.toBeNull();
  });

  it('sem sessão: não vai à rede nem mexe no banco', async () => {
    const database = criarBancoDeTeste();
    definirTokens(null);

    await executarSincronizacao(database);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await database.get('pedidos').query().fetchCount()).toBe(0);
  });

  it('sessão trocada durante o pull: a resposta do usuário antigo NÃO é gravada na réplica', async () => {
    const database = criarBancoDeTeste();
    let liberarPull!: (resposta: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolver) => {
          liberarPull = resolver;
        }),
    );

    const execucao = executarSincronizacao(database);
    await new Promise<void>((resolver) => setImmediate(() => resolver()));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Sai o usuário A e entra o B enquanto a requisição de A está pendurada.
    definirTokens({ accessToken: 'token-de-B', refreshToken: 'refresh-de-B' });
    liberarPull(respostaJson(200, syncPullFixture));
    await execucao;

    for (const tabela of TABELAS_SYNC) {
      expect(await database.get(tabela).query().fetchCount()).toBe(0);
    }
    expect(await getLastPulledAt(database)).toBeNull();
    // O erro de uma sessão que já acabou não suja o status da sessão atual.
    expect(lerStatusDaSincronizacao().ultimoErro).toBeNull();
  });

  it('wipe do banco durante o pull SEM troca de sessão (ex.: reconciliação do login): o WatermelonDB aborta a escrita', async () => {
    const database = criarBancoDeTeste();
    let liberarPull!: (resposta: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolver) => {
          liberarPull = resolver;
        }),
    );

    const execucao = executarSincronizacao(database);
    await new Promise<void>((resolver) => setImmediate(() => resolver()));

    // Mesma geração de sessão: só o `_resetCount` do banco avisa que a réplica é outra.
    await database.write(() => database.unsafeResetDatabase());
    liberarPull(respostaJson(200, syncPullFixture));
    await execucao;

    expect(await database.get('pedidos').query().fetchCount()).toBe(0);
    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
    expect(await getLastPulledAt(database)).toBeNull();
    expect(lerStatusDaSincronizacao().ultimoErro).toBe('falha');
  });

  it('logout (wipe do banco) durante o pull: nada é gravado e o lastPulledAt não volta', async () => {
    const database = criarBancoDeTeste();
    let liberarPull!: (resposta: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolver) => {
          liberarPull = resolver;
        }),
    );

    const execucao = executarSincronizacao(database);
    await new Promise<void>((resolver) => setImmediate(() => resolver()));

    definirTokens(null);
    await database.write(() => database.unsafeResetDatabase());
    liberarPull(respostaJson(200, syncPullFixture));
    await execucao;

    expect(await database.get('pedidos').query().fetchCount()).toBe(0);
    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
    expect(await getLastPulledAt(database)).toBeNull();
  });
});
