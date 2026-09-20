jest.mock('../../jornada/clienteJornadas', () => {
  const real = jest.requireActual('../../jornada/clienteJornadas');
  return {
    ErroApi: real.ErroApi,
    buscarJornadaAtual: jest.fn(),
    buscarHistorico: jest.fn(),
    enviarCheckin: jest.fn(),
    enviarCheckout: jest.fn(),
    enviarSolicitacaoPonto: jest.fn(),
  };
});
jest.mock('../../banco-horas/clienteBancoHoras', () => ({ buscarBancoHoras: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { Jornada } from '../../db/Jornada';
import { buscarBancoHoras } from '../../banco-horas/clienteBancoHoras';
import {
  ErroApi,
  buscarHistorico,
  buscarJornadaAtual,
  enviarCheckin,
  enviarCheckout,
} from '../../jornada/clienteJornadas';
import { paraJornadaDTO, queryJornadaAtual } from '../../jornada/espelhoJornada';
import { drenarFila, puxarBancoHoras, puxarJornadas } from '../syncManager';

const TOKEN = 'token-de-teste';

function jornadaFalsa(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
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
    ...parcial,
  };
}

describe('puxarJornadas', () => {
  it('grava a jornada atual e as do histórico no espelho local', async () => {
    const database = criarBancoDeTeste();
    (buscarJornadaAtual as jest.Mock).mockResolvedValue(jornadaFalsa({ id: 1 }));
    (buscarHistorico as jest.Mock).mockResolvedValue({
      periodoDias: 5,
      inicioPeriodo: '2026-09-05',
      fimPeriodo: '2026-09-09',
      totalMinutos: 480,
      dias: [
        {
          data: '2026-09-08',
          inicio: '2026-09-08T12:00:00.000Z',
          fim: '2026-09-08T20:00:00.000Z',
          minutosTrabalhados: 480,
          emAndamento: false,
          jornadas: [jornadaFalsa({ id: 2, status: StatusJornada.FINALIZADA })],
        },
      ],
    });

    await puxarJornadas(database, TOKEN);

    const registros = await database.get('jornadas').query().fetch();
    expect(registros).toHaveLength(2);
  });

  it('propaga o erro quando a rede falha (para o hook decidir o que fazer)', async () => {
    const database = criarBancoDeTeste();
    (buscarJornadaAtual as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    (buscarHistorico as jest.Mock).mockResolvedValue({
      periodoDias: 5,
      inicioPeriodo: '2026-09-05',
      fimPeriodo: '2026-09-09',
      totalMinutos: 0,
      dias: [],
    });

    await expect(puxarJornadas(database, TOKEN)).rejects.toThrow();
  });
});

describe('puxarBancoHoras', () => {
  it('grava o banco de horas do mes/ano pedido', async () => {
    const database = criarBancoDeTeste();
    (buscarBancoHoras as jest.Mock).mockResolvedValue({
      id: 1,
      usuarioId: 3,
      mes: 9,
      ano: 2026,
      horasTrabalhadas: 10,
      horasPrevistas: 176,
      saldo: -166,
    });

    await puxarBancoHoras(database, TOKEN, 9, 2026);

    const registros = await database.get('banco_horas').query().fetch();
    expect(registros).toHaveLength(1);
  });
});

describe('drenarFila', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sucesso: apaga a linha e reconcilia o registro otimista pelo idCliente, sem duplicar', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockResolvedValue(jornadaFalsa({ id: 99 }));
    await database.write(async () => {
      // Registro otimista, do jeito que `outbox.aplicarJornadaOtimista`
      // (Task 5) grava enquanto a ação só está na fila — remoteId null,
      // casável só pelo idCliente.
      await database.get<Jornada>('jornadas').create((registro) => {
        registro.remoteId = null;
        registro.usuarioId = -1;
        registro.status = StatusJornada.EM_ANDAMENTO;
        registro.checkinAt = '2026-09-09T12:00:00.000Z';
        registro.checkinLatitude = -19.9;
        registro.checkinLongitude = -43.9;
        registro.checkinEndereco = null;
        registro.checkoutAt = null;
        registro.checkoutLatitude = null;
        registro.checkoutLongitude = null;
        registro.checkoutEndereco = null;
        registro.lancadoEmAtraso = false;
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.idClienteCheckin = 'id-1';
        registro.idClienteCheckout = null;
      });
      await database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = 'id-1';
        registro.payload = JSON.stringify({ idCliente: 'id-1', latitude: -19.9, longitude: -43.9, registradoEm: '2026-09-09T12:00:00.000Z' });
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      });
    });

    await drenarFila(database, TOKEN);

    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(0);

    const jornadas = await queryJornadaAtual(database).fetch();
    expect(jornadas).toHaveLength(1); // reconciliou, não duplicou
    expect(paraJornadaDTO(jornadas[0]).id).toBe(99);
  });

  it('recusa 4xx: marca descartada com a mensagem, sem parar a fila', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(
      new ErroApi('JORNADA_EM_ANDAMENTO', 'Já existe uma jornada em andamento.', 409),
    );
    await database.write(() =>
      database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = 'id-1';
        registro.payload = JSON.stringify({ idCliente: 'id-1', latitude: -19.9, longitude: -43.9, registradoEm: '2026-09-09T12:00:00.000Z' });
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      }),
    );

    await drenarFila(database, TOKEN);

    const descartadas = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'descartada'))
      .fetch();
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].mensagemDescarte).toContain('JORNADA_EM_ANDAMENTO');
  });

  it('ordem FIFO: envia check-in antes do check-out, mesmo inserido depois de outro item', async () => {
    const database = criarBancoDeTeste();
    const ordem: string[] = [];
    (enviarCheckin as jest.Mock).mockImplementation(async () => {
      ordem.push('checkin');
      return jornadaFalsa({ id: 1 });
    });
    (enviarCheckout as jest.Mock).mockImplementation(async () => {
      ordem.push('checkout');
      return jornadaFalsa({ id: 1, status: StatusJornada.FINALIZADA });
    });
    await database.write(async () => {
      await database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = 'id-1';
        registro.payload = '{"idCliente":"id-1","latitude":-19.9,"longitude":-43.9,"registradoEm":"2026-09-09T12:00:00.000Z"}';
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      });
      await database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkout';
        registro.idCliente = 'id-2';
        registro.payload = '{"idCliente":"id-2","latitude":-19.9,"longitude":-43.9,"registradoEm":"2026-09-09T18:00:00.000Z"}';
        registro.criadoEm = '2026-09-09T18:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      });
    });

    await drenarFila(database, TOKEN);

    expect(ordem).toEqual(['checkin', 'checkout']);
  });

  it('falha de rede: para a drenagem sem descartar nem pular à frente', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await database.write(() =>
      database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = 'id-1';
        registro.payload = '{"idCliente":"id-1","latitude":-19.9,"longitude":-43.9,"registradoEm":"2026-09-09T12:00:00.000Z"}';
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      }),
    );

    await drenarFila(database, TOKEN);

    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();
    expect(pendentes).toHaveLength(1);
  });
});
