jest.mock('../../jornada/clienteJornadas', () => {
  const real = jest.requireActual('../../jornada/clienteJornadas');
  return {
    ErroApi: real.ErroApi,
    enviarCheckin: jest.fn(),
    enviarCheckout: jest.fn(),
    enviarSolicitacaoPonto: jest.fn(),
  };
});

import { Q } from '@nozbe/watermelondb';
import { StatusJornada, type CheckinRequest, type JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import {
  ErroApi,
  enviarCheckin,
  enviarCheckout,
  enviarSolicitacaoPonto,
} from '../../jornada/clienteJornadas';
import { queryJornadaAtual, paraJornadaDTO } from '../../jornada/espelhoJornada';
import { executarAcaoJornada, executarAcaoPontoEmAtraso } from '../outbox';

const TOKEN = 'token-de-teste';

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
};

describe('executarAcaoJornada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sucesso online: grava a jornada com remoteId e não deixa nada na fila', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockResolvedValue(JORNADA_SERVIDOR);

    const resultado = await executarAcaoJornada(database, 'checkin', TOKEN, PAYLOAD_CHECKIN);

    expect(resultado).toEqual({ tipo: 'ok', dado: JORNADA_SERVIDOR });
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(0);
    const registros = await queryJornadaAtual(database).fetch();
    expect(paraJornadaDTO(registros[0]).id).toBe(42);
  });

  it('offline: grava localmente de forma otimista, fica na fila, e devolve ok mesmo assim', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

    const resultado = await executarAcaoJornada(database, 'checkin', TOKEN, PAYLOAD_CHECKIN);

    expect(resultado.tipo).toBe('ok');
    const registros = await queryJornadaAtual(database).fetch();
    expect(registros).toHaveLength(1);
    expect(paraJornadaDTO(registros[0]).id).toBe(-1); // remoteId ainda null
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].tipo).toBe('checkin');
  });

  it('recusa 4xx na tentativa imediata: devolve recusado e não deixa nada na fila', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(
      new ErroApi('JORNADA_EM_ANDAMENTO', 'Já existe uma jornada em andamento.', 409),
    );

    const resultado = await executarAcaoJornada(database, 'checkin', TOKEN, PAYLOAD_CHECKIN);

    expect(resultado).toEqual({ tipo: 'recusado', codigo: 'JORNADA_EM_ANDAMENTO' });
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(0);
  });

  it('checkout chama enviarCheckout, não enviarCheckin', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckout as jest.Mock).mockResolvedValue({ ...JORNADA_SERVIDOR, status: StatusJornada.FINALIZADA });

    await executarAcaoJornada(database, 'checkout', TOKEN, {
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

    const resultado = await executarAcaoPontoEmAtraso(database, TOKEN, {
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
