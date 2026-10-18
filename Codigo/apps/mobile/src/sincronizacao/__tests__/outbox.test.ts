jest.mock('../../jornada/clienteJornadas', () => {
  return {
    enviarCheckin: jest.fn(),
    enviarCheckout: jest.fn(),
    enviarSolicitacaoPonto: jest.fn(),
  };
});

import { Q } from '@nozbe/watermelondb';
import { StatusJornada, type CheckinRequest, type JornadaDTO } from '@montacontrol/shared';
import { ErroApi } from '../../http/erroApi';
import {
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  linhaDeJornada,
} from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import {
  enviarCheckin,
  enviarCheckout,
  enviarSolicitacaoPonto,
} from '../../jornada/clienteJornadas';
import { lerJornadasComPendentes } from '../../jornada/jornadasComPendentes';
import { executarAcaoJornada, executarAcaoPontoEmAtraso } from '../outbox';

const JORNADA_SERVIDOR: JornadaDTO = {
  id: 42,
  usuarioId: 3,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-09-09T12:00:00.000Z',
  checkinLatitude: -19.9,
  checkinLongitude: -43.9,
  checkinEndereco: 'Rua Falsa, 123',
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-09-09T12:00:00.000Z',
};

const PAYLOAD_CHECKIN: CheckinRequest = {
  idCliente: 'id-cliente-1',
  latitude: -19.9,
  longitude: -43.9,
  registradoEm: '2026-09-09T12:00:00.000Z',
  endereco: 'Rua Falsa, 123',
  pedidoId: 10,
};

const acoesNaFila = (database: ReturnType<typeof criarBancoDeTeste>) =>
  database.get<AcaoPendente>('acoes_pendentes').query().fetch();

const linhaDeJornadaAberta = () =>
  linhaDeJornada({
    id: '42',
    status: StatusJornada.EM_ANDAMENTO,
    checkout_at: null,
    checkout_latitude: null,
    checkout_longitude: null,
    checkout_endereco: null,
    checkout_id_cliente: null,
  });

describe('executarAcaoJornada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sucesso online: devolve a jornada do servidor, não grava na réplica e deixa a ação como enviada', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockResolvedValue(JORNADA_SERVIDOR);

    const resultado = await executarAcaoJornada(database, 'checkin', PAYLOAD_CHECKIN);

    expect(resultado).toEqual({ tipo: 'ok', dado: JORNADA_SERVIDOR });
    // A réplica só é escrita pelo synchronize().
    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
    // A jornada continua na tela até o pull trazê-la: a ação fica `enviada`.
    const fila = await acoesNaFila(database);
    expect(fila.map((a) => a.status)).toEqual(['enviada']);
    expect(
      await database
        .get<AcaoPendente>('acoes_pendentes')
        .query(Q.where('status', 'pendente'))
        .fetchCount(),
    ).toBe(0);
    expect(await lerJornadasComPendentes(database)).toHaveLength(1);
  });

  it('offline: fica na fila, aparece na hora (sobreposição) e devolve ok mesmo assim', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const resultado = await executarAcaoJornada(database, 'checkin', PAYLOAD_CHECKIN);

    expect(resultado.tipo).toBe('ok');
    // Nada na réplica; a jornada exibida vem só da ação pendente.
    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
    const exibidas = await lerJornadasComPendentes(database);
    expect(exibidas).toHaveLength(1);
    expect(exibidas[0]).toMatchObject({
      status: StatusJornada.EM_ANDAMENTO,
      checkinAt: PAYLOAD_CHECKIN.registradoEm,
      pedidoId: 10,
    });
    if (resultado.tipo === 'ok') {
      expect(resultado.dado.id).toBeLessThan(0); // ainda sem id do servidor
      expect(resultado.dado.status).toBe(StatusJornada.EM_ANDAMENTO);
    }
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tipo).toBe('checkin');
  });

  it('recusa 4xx na tentativa imediata: devolve recusado e não deixa nada na fila nem na tela', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(
      new ErroApi('JORNADA_EM_ANDAMENTO', 'Já existe uma jornada em andamento.', 409),
    );

    const resultado = await executarAcaoJornada(database, 'checkin', PAYLOAD_CHECKIN);

    expect(resultado).toEqual({ tipo: 'recusado', codigo: 'JORNADA_EM_ANDAMENTO' });
    expect(await acoesNaFila(database)).toHaveLength(0);
    expect(await lerJornadasComPendentes(database)).toHaveLength(0);
  });

  it('checkout recusado (4xx) sobre jornada aberta da réplica: a jornada segue aberta e a fila fica vazia', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [linhaDeJornadaAberta()]);
    (enviarCheckout as jest.Mock).mockRejectedValue(
      new ErroApi('JORNADA_NAO_ENCONTRADA', 'Jornada não encontrada.', 404),
    );

    const resultado = await executarAcaoJornada(database, 'checkout', {
      idCliente: 'id-cliente-checkout-1',
      latitude: -19.91,
      longitude: -43.91,
      registradoEm: '2026-10-15T18:00:00.000Z',
    });

    expect(resultado).toEqual({ tipo: 'recusado', codigo: 'JORNADA_NAO_ENCONTRADA' });
    expect(await acoesNaFila(database)).toHaveLength(0);
    const exibidas = await lerJornadasComPendentes(database);
    expect(exibidas).toHaveLength(1);
    expect(exibidas[0].status).toBe(StatusJornada.EM_ANDAMENTO);
    expect(exibidas[0].checkoutAt).toBeNull();
  });

  it('checkout offline sobre jornada aberta da réplica: a tela mostra a finalizada e a réplica não muda', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [linhaDeJornadaAberta()]);
    (enviarCheckout as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const resultado = await executarAcaoJornada(database, 'checkout', {
      idCliente: 'id-cliente-checkout-2',
      latitude: -19.91,
      longitude: -43.91,
      registradoEm: '2026-10-15T18:00:00.000Z',
    });

    expect(resultado.tipo).toBe('ok');
    if (resultado.tipo === 'ok') {
      expect(resultado.dado).toMatchObject({
        id: 42,
        status: StatusJornada.FINALIZADA,
        checkoutAt: '2026-10-15T18:00:00.000Z',
      });
    }
    const linha = await database.get('jornadas').find('42');
    expect(linha._raw).toMatchObject({ status: StatusJornada.EM_ANDAMENTO, checkout_at: null });
  });

  it('checkout chama enviarCheckout, não enviarCheckin', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckout as jest.Mock).mockResolvedValue({
      ...JORNADA_SERVIDOR,
      status: StatusJornada.FINALIZADA,
    });

    await executarAcaoJornada(database, 'checkout', {
      idCliente: 'id-cliente-2',
      latitude: -19.9,
      longitude: -43.9,
      registradoEm: '2026-09-09T18:00:00.000Z',
    });

    expect(enviarCheckout).toHaveBeenCalled();
    expect(enviarCheckin).not.toHaveBeenCalled();
  });
});

describe('executarAcaoPontoEmAtraso', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offline: fica na fila e devolve ok mesmo assim', async () => {
    const database = criarBancoDeTeste();
    (enviarSolicitacaoPonto as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const resultado = await executarAcaoPontoEmAtraso(database, {
      idCliente: 'id-cliente-3',
      data: '2026-09-08',
      horaInicio: '08:00',
      horaFim: '17:00',
      justificativa: 'Esqueci o celular em casa.',
    });

    expect(resultado).toEqual({ tipo: 'ok' });
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('tipo', 'ponto_em_atraso'), Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(1);
  });
});
