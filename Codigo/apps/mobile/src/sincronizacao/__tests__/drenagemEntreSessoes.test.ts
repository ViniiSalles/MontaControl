import { Q } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { drenarFila } from '../syncManager';

// Segurança: ação de um usuário nunca sai com o token de outro. A drenagem
// carrega a fila em memória; se a sessão trocar (sair/expirar e outro entrar)
// enquanto uma requisição está pendurada, o laço para sem enviar nem mexer em nada.
jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

const fetchMock = jest.fn();

const JORNADA_SERVIDOR: JornadaDTO = {
  id: 7,
  usuarioId: 1,
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

async function bancoComDuasAcoes() {
  const database = criarBancoDeTeste();
  await database.write(async () => {
    for (const [idCliente, criadoEm] of [
      ['id-1', '2026-09-09T12:00:00.000Z'],
      ['id-2', '2026-09-09T13:00:00.000Z'],
    ]) {
      await database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = idCliente;
        registro.payload = JSON.stringify({
          idCliente,
          latitude: -19.9,
          longitude: -43.9,
          registradoEm: criadoEm,
        });
        registro.criadoEm = criadoEm;
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      });
    }
  });
  return database;
}

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock;
  definirTokens({ accessToken: 'token-de-A', refreshToken: 'refresh-de-A' });
});

describe('drenarFila atravessando a troca de sessão', () => {
  test('a 1ª requisição pendura, a sessão vira de A para B, e a 2ª ação NÃO sai com o token de B', async () => {
    const database = await bancoComDuasAcoes();
    let liberarPrimeira!: (resposta: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolver) => {
          liberarPrimeira = resolver;
        }),
    );
    fetchMock.mockResolvedValue(respostaJson(201, JORNADA_SERVIDOR));

    const drenagem = drenarFila(database);
    await new Promise<void>((resolver) => setImmediate(() => resolver()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-de-A');

    // A sai (ou expira) e B entra enquanto a 1ª requisição segue no ar.
    definirTokens(null);
    definirTokens({ accessToken: 'token-de-B', refreshToken: 'refresh-de-B' });
    liberarPrimeira(respostaJson(201, JORNADA_SERVIDOR));
    await drenagem;

    // Nada mais foi enviado, e nada foi marcado/gravado com o resultado da sessão antiga.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const chamadasComTokenDeB = fetchMock.mock.calls.filter(
      ([, init]) => init.headers.Authorization === 'Bearer token-de-B',
    );
    expect(chamadasComTokenDeB).toHaveLength(0);
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetchCount();
    expect(pendentes).toBe(2);
    expect(
      await database.get('acoes_pendentes').query(Q.where('status', 'descartada')).fetchCount(),
    ).toBe(0);
    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
  });

  test('sem troca de sessão a drenagem segue normal, uma ação após a outra', async () => {
    const database = await bancoComDuasAcoes();
    fetchMock.mockResolvedValue(respostaJson(201, JORNADA_SERVIDOR));

    await drenarFila(database);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Aceitas, as duas ficam `enviada` (aguardando o pull); nenhuma segue pendente.
    expect(
      await database.get('acoes_pendentes').query(Q.where('status', 'pendente')).fetchCount(),
    ).toBe(0);
    expect(
      await database.get('acoes_pendentes').query(Q.where('status', 'enviada')).fetchCount(),
    ).toBe(2);
  });

  test('sessão trocada logo antes de começar a enviar: não envia a ação sob outro token', async () => {
    const database = await bancoComDuasAcoes();
    // A fila é lida (await) antes do envio; a sessão troca nesse intervalo.
    const leitura = database.get<AcaoPendente>('acoes_pendentes').query().fetch();
    const drenagem = drenarFila(database);
    definirTokens({ accessToken: 'token-de-B', refreshToken: 'refresh-de-B' });
    await leitura;
    await drenagem;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await database.get('acoes_pendentes').query(Q.where('status', 'pendente')).fetchCount(),
    ).toBe(2);
  });
});
