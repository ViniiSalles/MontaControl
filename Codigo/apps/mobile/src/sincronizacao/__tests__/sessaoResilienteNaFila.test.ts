import { Q } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { aoSessaoExpirar, definirTokens, obterTokenValido } from '../../auth/tokenSessao';
import { montador, respostaJson, sessaoDe } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { ehRecusaDoServidor } from '../outbox';
import { ErroApi } from '../../http/erroApi';
import { drenarFila } from '../syncManager';

// Ponta a ponta da #106 sem duplos nos clientes HTTP: fila real (Loki), clientes
// reais, fonte única de token real. Só `fetch` e o SecureStore são falsos.
jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

const JORNADA_SERVIDOR: JornadaDTO = {
  id: 7,
  usuarioId: 3,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-09-09T12:00:00.000Z',
  checkinLatitude: -19.9,
  checkinLongitude: -43.9,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-09-09T12:00:00.000Z',
};

const RESPOSTA_401 = () => respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' });

async function bancoComCheckinPendente() {
  const database = criarBancoDeTeste();
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = 'id-1';
      registro.payload = JSON.stringify({
        idCliente: 'id-1',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: '2026-09-09T12:00:00.000Z',
      });
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'pendente';
      registro.mensagemDescarte = null;
    }),
  );
  return database;
}

async function contar(database: ReturnType<typeof criarBancoDeTeste>, status: string) {
  return database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('status', status))
    .fetchCount();
}

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'velho', refreshToken: 'refresh' });
});

describe('ehRecusaDoServidor', () => {
  test.each([400, 403, 404, 409, 422])('%i é recusa de regra de negócio', (status) => {
    expect(ehRecusaDoServidor(new ErroApi('X', 'x', status))).toBe(true);
  });

  test.each([401, 408, 429, 500, 503])('%i não é recusa: a ação segue na fila', (status) => {
    expect(ehRecusaDoServidor(new ErroApi('X', 'x', status))).toBe(false);
  });

  test('erro de rede (não é ErroApi) não é recusa', () => {
    expect(ehRecusaDoServidor(new TypeError('Network request failed'))).toBe(false);
  });
});

describe('drenarFila com os clientes reais', () => {
  test('token expirado: renova a sessão, reenvia a ação com o token novo e ela sai da fila', async () => {
    const database = await bancoComCheckinPendente();
    fetchMock
      .mockResolvedValueOnce(RESPOSTA_401()) // POST /jornadas/checkin com o token velho
      .mockResolvedValueOnce(respostaJson(200, sessaoDe(montador, '-novo'))) // POST /auth/refresh
      .mockResolvedValueOnce(respostaJson(201, JORNADA_SERVIDOR)); // POST /jornadas/checkin repetido

    await drenarFila(database);

    expect(await contar(database, 'pendente')).toBe(0);
    expect(await contar(database, 'descartada')).toBe(0);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer velho');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer access-novo');
    await expect(obterTokenValido()).resolves.toBe('access-novo');
  });

  test('token expirado e sem rede para renovar: a ação segue pendente e sobe quando a rede volta', async () => {
    const database = await bancoComCheckinPendente();
    fetchMock
      .mockResolvedValueOnce(RESPOSTA_401())
      .mockRejectedValueOnce(new TypeError('Network request failed')); // POST /auth/refresh

    await drenarFila(database);

    expect(await contar(database, 'pendente')).toBe(1);
    expect(await contar(database, 'descartada')).toBe(0);

    // Rede de volta: a sessão ainda é a mesma, a renovação agora funciona.
    fetchMock
      .mockResolvedValueOnce(RESPOSTA_401())
      .mockResolvedValueOnce(respostaJson(200, sessaoDe(montador, '-novo')))
      .mockResolvedValueOnce(respostaJson(201, JORNADA_SERVIDOR));
    await drenarFila(database);

    expect(await contar(database, 'pendente')).toBe(0);
  });

  test('refresh recusado: a sessão acaba (quem ouve é avisado) e a ação não é descartada pela fila', async () => {
    const database = await bancoComCheckinPendente();
    const aoExpirar = jest.fn();
    const cancelar = aoSessaoExpirar(aoExpirar);
    fetchMock
      .mockResolvedValueOnce(RESPOSTA_401())
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' }));

    await drenarFila(database);
    cancelar();

    expect(aoExpirar).toHaveBeenCalledTimes(1);
    expect(await contar(database, 'pendente')).toBe(1);
    expect(await contar(database, 'descartada')).toBe(0);
  });

  test('sem sessão: não vai à rede e a ação segue pendente', async () => {
    const database = await bancoComCheckinPendente();
    definirTokens(null);

    await drenarFila(database);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await contar(database, 'pendente')).toBe(1);
  });

  test('409 do servidor ainda descarta com a mensagem, sem tentar renovar a sessão', async () => {
    const database = await bancoComCheckinPendente();
    fetchMock.mockResolvedValueOnce(
      respostaJson(409, {
        codigo: 'JORNADA_EM_ANDAMENTO',
        message: 'Já existe uma jornada em andamento.',
      }),
    );

    await drenarFila(database);

    const descartadas = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'descartada'))
      .fetch();
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].mensagemDescarte).toBe('Ação recusada: JORNADA_EM_ANDAMENTO.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
