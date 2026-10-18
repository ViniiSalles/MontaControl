jest.mock('../../avarias/clienteAvarias', () => ({ enviarAvaria: jest.fn() }));
jest.mock('../../jornada/clienteJornadas', () => ({
  buscarJornadaAtual: jest.fn(),
  buscarHistorico: jest.fn(),
  enviarCheckin: jest.fn(),
  enviarCheckout: jest.fn(),
  enviarSolicitacaoPonto: jest.fn(),
}));
jest.mock('../../banco-horas/clienteBancoHoras', () => ({ buscarBancoHoras: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import { StatusJornada } from '@montacontrol/shared';
import type { CheckinRequest, JornadaDTO, ReportarAvariaRequest } from '@montacontrol/shared';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { ErroApi } from '../../http/erroApi';
import { enviarCheckin, enviarSolicitacaoPonto } from '../../jornada/clienteJornadas';
import { lerJornadasComPendentes } from '../../jornada/jornadasComPendentes';
import { executarAcaoAvaria, executarAcaoJornada, executarAcaoPontoEmAtraso } from '../outbox';
import { drenarFila } from '../syncManager';

// #106: 401 não é recusa do servidor. O token expira durante a sessão (1h) e
// o montador pode ficar horas sem sinal — a ação que bate 401 fica na fila até
// existir sessão válida; só 4xx de regra de negócio descarta.

type Banco = ReturnType<typeof criarBancoDeTeste>;

const enviarCheckinMock = jest.mocked(enviarCheckin);
const enviarPontoMock = jest.mocked(enviarSolicitacaoPonto);
const enviarAvariaMock = jest.mocked(enviarAvaria);

const erro401 = () => new ErroApi('TOKEN_EXPIRADO', 'Sessão expirada', 401);

const CHECKIN: CheckinRequest = {
  idCliente: 'id-1',
  latitude: -19.9,
  longitude: -43.9,
  registradoEm: '2026-09-09T12:00:00.000Z',
  pedidoId: 10,
};

const AVARIA: ReportarAvariaRequest = {
  idCliente: 'id-avaria-1',
  pecaId: 10,
  tipoAvariaId: 2,
  descricao: 'Porta riscada',
};

const JORNADA_SERVIDOR: JornadaDTO = {
  id: 7,
  usuarioId: 3,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: CHECKIN.registradoEm,
  checkinLatitude: -19.9,
  checkinLongitude: -43.9,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: CHECKIN.registradoEm,
};

async function acoesComStatus(database: Banco, status: string) {
  return database.get<AcaoPendente>('acoes_pendentes').query(Q.where('status', status)).fetch();
}

async function enfileirarCheckin(database: Banco, idCliente: string, criadoEm: string) {
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = idCliente;
      registro.payload = JSON.stringify({ ...CHECKIN, idCliente, registradoEm: criadoEm });
      registro.criadoEm = criadoEm;
      registro.status = 'pendente';
      registro.mensagemDescarte = null;
    }),
  );
}

beforeEach(() => jest.clearAllMocks());

describe('drenarFila com 401', () => {
  test('401 não é recusa: a ação continua pendente, sem mensagem de descarte', async () => {
    const database = criarBancoDeTeste();
    enviarCheckinMock.mockRejectedValue(erro401());
    await enfileirarCheckin(database, 'id-1', '2026-09-09T12:00:00.000Z');

    await drenarFila(database);

    expect(await acoesComStatus(database, 'descartada')).toHaveLength(0);
    const pendentes = await acoesComStatus(database, 'pendente');
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].mensagemDescarte).toBeNull();
  });

  test('401 para a drenagem, como falha de rede: a ação seguinte não é tentada', async () => {
    const database = criarBancoDeTeste();
    enviarCheckinMock.mockRejectedValue(erro401());
    await enfileirarCheckin(database, 'id-1', '2026-09-09T12:00:00.000Z');
    await enfileirarCheckin(database, 'id-2', '2026-09-09T13:00:00.000Z');

    await drenarFila(database);

    expect(enviarCheckinMock).toHaveBeenCalledTimes(1);
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(2);
  });

  test('depois que a sessão volta a valer, a ação que tinha tomado 401 é enviada e sai da fila', async () => {
    const database = criarBancoDeTeste();
    enviarCheckinMock.mockRejectedValueOnce(erro401()).mockResolvedValueOnce(JORNADA_SERVIDOR);
    await enfileirarCheckin(database, 'id-1', '2026-09-09T12:00:00.000Z');

    await drenarFila(database);
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(1);

    await drenarFila(database);

    expect(enviarCheckinMock).toHaveBeenCalledTimes(2);
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(0);
    expect(await acoesComStatus(database, 'descartada')).toHaveLength(0);
  });

  test.each([400, 403, 409, 422])(
    'recusa de regra de negócio %i continua descartando, com a mensagem',
    async (status) => {
      const database = criarBancoDeTeste();
      enviarCheckinMock.mockRejectedValue(new ErroApi('REGRA_VIOLADA', 'Regra violada.', status));
      await enfileirarCheckin(database, 'id-1', '2026-09-09T12:00:00.000Z');

      await drenarFila(database);

      const descartadas = await acoesComStatus(database, 'descartada');
      expect(descartadas).toHaveLength(1);
      expect(descartadas[0].mensagemDescarte).toBe('Ação recusada: REGRA_VIOLADA.');
      expect(await acoesComStatus(database, 'pendente')).toHaveLength(0);
    },
  );

  test.each([408, 429, 503])(
    '%i é transitório e não decide nada sobre a ação: segue pendente',
    async (status) => {
      const database = criarBancoDeTeste();
      enviarCheckinMock.mockRejectedValue(new ErroApi('TRANSITORIO', 'Tente de novo.', status));
      await enfileirarCheckin(database, 'id-1', '2026-09-09T12:00:00.000Z');

      await drenarFila(database);

      expect(await acoesComStatus(database, 'pendente')).toHaveLength(1);
      expect(await acoesComStatus(database, 'descartada')).toHaveLength(0);
    },
  );

  test('avaria com 401 fica pendente e o reenvio posterior a entrega', async () => {
    const database = criarBancoDeTeste();
    enviarAvariaMock.mockRejectedValueOnce(erro401());

    expect(await executarAcaoAvaria(database, AVARIA)).toEqual({ tipo: 'pendente' });
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(1);

    enviarAvariaMock.mockResolvedValue({} as never);
    await drenarFila(database);

    expect(await acoesComStatus(database, 'pendente')).toHaveLength(0);
    expect(await acoesComStatus(database, 'descartada')).toHaveLength(0);
  });
});

describe('envio imediato (outbox) com 401', () => {
  test('check-in com 401 não perde a marcação: fica na fila e continua aparecendo na tela', async () => {
    const database = criarBancoDeTeste();
    enviarCheckinMock.mockRejectedValue(erro401());

    const resultado = await executarAcaoJornada(database, 'checkin', CHECKIN);

    expect(resultado.tipo).toBe('ok');
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(1);
    expect(await lerJornadasComPendentes(database)).toHaveLength(1);
  });

  test('ponto em atraso com 401 fica na fila', async () => {
    const database = criarBancoDeTeste();
    enviarPontoMock.mockRejectedValue(erro401());

    const resultado = await executarAcaoPontoEmAtraso(database, {
      idCliente: 'id-ponto-1',
      data: '2026-09-08',
      horaInicio: '08:00',
      horaFim: '17:00',
      justificativa: 'Sem sinal na obra.',
    });

    expect(resultado).toEqual({ tipo: 'ok' });
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(1);
  });

  test('check-in recusado com 422 continua descartando a ação, que também some da tela', async () => {
    const database = criarBancoDeTeste();
    enviarCheckinMock.mockRejectedValue(new ErroApi('FORA_DO_RAIO', 'Fora do raio.', 422));

    const resultado = await executarAcaoJornada(database, 'checkin', CHECKIN);

    expect(resultado).toEqual({ tipo: 'recusado', codigo: 'FORA_DO_RAIO' });
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(0);
    expect(await lerJornadasComPendentes(database)).toHaveLength(0);
  });

  test('avaria recusada com 422 continua saindo da fila, com a mensagem do servidor', async () => {
    const database = criarBancoDeTeste();
    enviarAvariaMock.mockRejectedValue(new ErroApi('PECA_INVALIDA', 'Peça inválida.', 422));

    expect(await executarAcaoAvaria(database, AVARIA)).toEqual({
      tipo: 'recusado',
      codigo: 'PECA_INVALIDA',
      mensagem: 'Peça inválida.',
    });
    expect(await acoesComStatus(database, 'pendente')).toHaveLength(0);
  });
});
