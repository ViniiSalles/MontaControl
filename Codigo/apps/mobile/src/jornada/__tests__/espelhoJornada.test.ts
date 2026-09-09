import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import {
  construirHistoricoDTO,
  janelaDoPeriodo,
  paraJornadaDTO,
  queryJornadaAtual,
  queryJornadasNoPeriodo,
  upsertJornadas,
  reconciliarJornadaOtimista,
} from '../espelhoJornada';

function jornadaFalsa(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: 3,
    status: StatusJornada.FINALIZADA,
    checkinAt: '2026-09-09T12:00:00.000Z',
    checkinLatitude: -19.9,
    checkinLongitude: -43.9,
    checkinEndereco: 'Rua Falsa, 123',
    checkoutAt: '2026-09-09T18:00:00.000Z',
    checkoutLatitude: -19.9,
    checkoutLongitude: -43.9,
    checkoutEndereco: 'Rua Falsa, 123',
    lancadoEmAtraso: false,
    criadoEm: '2026-09-09T12:00:00.000Z',
    ...parcial,
  };
}

describe('upsertJornadas', () => {
  it('cria na primeira vez e atualiza (não duplica) na segunda, pelo remoteId', async () => {
    const database = criarBancoDeTeste();

    await upsertJornadas(database, [jornadaFalsa({ id: 1, status: StatusJornada.EM_ANDAMENTO })]);
    await upsertJornadas(database, [jornadaFalsa({ id: 1, status: StatusJornada.FINALIZADA })]);

    const registros = await queryJornadasNoPeriodo(
      database,
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T23:59:59.999Z',
    ).fetch();

    expect(registros).toHaveLength(1);
    expect(paraJornadaDTO(registros[0]).status).toBe(StatusJornada.FINALIZADA);
  });
});

describe('queryJornadaAtual', () => {
  it('só traz a jornada com status EM_ANDAMENTO', async () => {
    const database = criarBancoDeTeste();
    await upsertJornadas(database, [
      jornadaFalsa({ id: 1, status: StatusJornada.FINALIZADA }),
      jornadaFalsa({ id: 2, status: StatusJornada.EM_ANDAMENTO, checkoutAt: null }),
    ]);

    const registros = await queryJornadaAtual(database).fetch();

    expect(registros).toHaveLength(1);
    expect(paraJornadaDTO(registros[0]).id).toBe(2);
  });
});

describe('janelaDoPeriodo', () => {
  it('5 dias termina no dia civil de agora e começa 4 dias antes', () => {
    const janela = janelaDoPeriodo(5, '2026-09-09T15:00:00.000Z'); // 12:00 local (UTC-3)

    expect(janela.fimPeriodo).toBe('2026-09-09');
    expect(janela.inicioPeriodo).toBe('2026-09-05');
  });
});

describe('construirHistoricoDTO', () => {
  it('agrupa por dia e soma os minutos, reaproveitando agruparJornadasPorDia', async () => {
    const database = criarBancoDeTeste();
    await upsertJornadas(database, [jornadaFalsa({ id: 1 })]);
    const registros = await queryJornadasNoPeriodo(
      database,
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T23:59:59.999Z',
    ).fetch();

    const historico = construirHistoricoDTO(registros, 5, '2026-09-09T15:00:00.000Z');

    expect(historico.periodoDias).toBe(5);
    expect(historico.dias).toHaveLength(1);
    expect(historico.dias[0].minutosTrabalhados).toBe(360);
    expect(historico.totalMinutos).toBe(360);
  });
});

describe('reconciliarJornadaOtimista', () => {
  it('casa pelo idCliente do check-in e atualiza o registro existente, sem duplicar', async () => {
    const database = criarBancoDeTeste();
    // Simula o que `outbox.aplicarJornadaOtimista` (Task 5) grava ao enfileirar
    // um check-in offline: remote_id null, casável só pelo idCliente.
    await database.write(() =>
      database.get('jornadas').create((registro: any) => {
        registro.remoteId = null;
        registro.usuarioId = -1;
        registro.status = StatusJornada.EM_ANDAMENTO;
        registro.checkinAt = '2026-09-09T12:00:00.000Z';
        registro.checkinLatitude = -19.9;
        registro.checkinLongitude = -43.9;
        registro.checkinEndereco = 'Rua Falsa, 123';
        registro.checkoutAt = null;
        registro.checkoutLatitude = null;
        registro.checkoutLongitude = null;
        registro.checkoutEndereco = null;
        registro.lancadoEmAtraso = false;
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.idClienteCheckin = 'id-cliente-1';
        registro.idClienteCheckout = null;
      }),
    );

    await reconciliarJornadaOtimista(database, 'id-cliente-1', jornadaFalsa({ id: 77, status: StatusJornada.EM_ANDAMENTO, checkoutAt: null }));

    const registros = await queryJornadaAtual(database).fetch();
    expect(registros).toHaveLength(1); // não duplicou
    expect(paraJornadaDTO(registros[0]).id).toBe(77);
  });

  it('sem registro otimista correspondente, cria um novo (recuperação de instalação nova)', async () => {
    const database = criarBancoDeTeste();

    await reconciliarJornadaOtimista(database, 'id-cliente-inexistente', jornadaFalsa({ id: 88 }));

    const registros = await queryJornadasNoPeriodo(
      database,
      '2026-09-01T00:00:00.000Z',
      '2026-09-30T23:59:59.999Z',
    ).fetch();
    expect(registros).toHaveLength(1);
    expect(paraJornadaDTO(registros[0]).id).toBe(88);
  });
});
