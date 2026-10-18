import { StatusJornada, syncPullFixture } from '@montacontrol/shared';
import type { CheckinRequest, CheckoutRequest } from '@montacontrol/shared';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  gravarPullNaReplica,
  linhaDeJornada,
} from '../../db/__tests__/apoio';
import {
  lerJornadasComPendentes,
  sobreporAcoesPendentes,
} from '../jornadasComPendentes';
import type { AcaoDeJornada, JornadaExibida } from '../jornadasComPendentes';

function jornadaDaReplica(parcial: Partial<JornadaExibida> = {}): JornadaExibida {
  return {
    id: 501,
    usuarioId: 7,
    status: StatusJornada.FINALIZADA,
    checkinAt: '2026-10-15T11:00:00.000Z',
    checkinLatitude: -19.9,
    checkinLongitude: -43.9,
    checkinEndereco: null,
    checkoutAt: '2026-10-15T20:00:00.000Z',
    checkoutLatitude: -19.9,
    checkoutLongitude: -43.9,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-10-15T11:00:01.000Z',
    pedidoId: 12,
    checkinIdCliente: 'checkin-501',
    checkoutIdCliente: 'checkout-501',
    ...parcial,
  };
}

const PAYLOAD_CHECKIN: CheckinRequest = {
  idCliente: 'checkin-novo',
  latitude: -19.92,
  longitude: -43.94,
  registradoEm: '2026-10-17T11:00:00.000Z',
  endereco: 'Rua Nova, 1',
  pedidoId: 12,
};

const PAYLOAD_CHECKOUT: CheckoutRequest = {
  idCliente: 'checkout-novo',
  latitude: -19.93,
  longitude: -43.95,
  registradoEm: '2026-10-17T20:00:00.000Z',
};

function acaoCheckin(parcial: Partial<AcaoDeJornada> = {}): AcaoDeJornada {
  return {
    tipo: 'checkin',
    idCliente: PAYLOAD_CHECKIN.idCliente,
    payload: PAYLOAD_CHECKIN,
    criadoEm: '2026-10-17T11:00:01.000Z',
    ...parcial,
  } as AcaoDeJornada;
}

function acaoCheckout(parcial: Partial<AcaoDeJornada> = {}): AcaoDeJornada {
  return {
    tipo: 'checkout',
    idCliente: PAYLOAD_CHECKOUT.idCliente,
    payload: PAYLOAD_CHECKOUT,
    criadoEm: '2026-10-17T20:00:01.000Z',
    ...parcial,
  } as AcaoDeJornada;
}

describe('sobreporAcoesPendentes', () => {
  it('sem ações pendentes devolve a réplica como está', () => {
    const replica = [jornadaDaReplica()];
    expect(sobreporAcoesPendentes(replica, [])).toEqual(replica);
  });

  it('check-in pendente vira uma jornada em andamento exibível, com a obra do payload', () => {
    const resultado = sobreporAcoesPendentes([], [acaoCheckin()]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      status: StatusJornada.EM_ANDAMENTO,
      checkinAt: PAYLOAD_CHECKIN.registradoEm,
      checkinLatitude: PAYLOAD_CHECKIN.latitude,
      checkinLongitude: PAYLOAD_CHECKIN.longitude,
      checkinEndereco: 'Rua Nova, 1',
      checkoutAt: null,
      lancadoEmAtraso: false,
      pedidoId: 12,
      checkinIdCliente: 'checkin-novo',
      checkoutIdCliente: null,
    });
    // Ainda não existe no servidor: id provisório, sempre negativo.
    expect(resultado[0].id).toBeLessThan(0);
  });

  it('a ação some da sobreposição quando a réplica já tem a jornada com o mesmo checkin_id_cliente', () => {
    const naReplica = jornadaDaReplica({
      id: 700,
      status: StatusJornada.EM_ANDAMENTO,
      checkinAt: PAYLOAD_CHECKIN.registradoEm,
      checkoutAt: null,
      checkinIdCliente: 'checkin-novo',
      checkoutIdCliente: null,
    });

    const resultado = sobreporAcoesPendentes([naReplica], [acaoCheckin()]);

    expect(resultado).toEqual([naReplica]);
  });

  it('check-out pendente fecha a jornada em andamento da réplica', () => {
    const aberta = jornadaDaReplica({
      id: 502,
      status: StatusJornada.EM_ANDAMENTO,
      checkinAt: '2026-10-17T11:00:00.000Z',
      checkoutAt: null,
      checkoutLatitude: null,
      checkoutLongitude: null,
      checkinIdCliente: 'checkin-502',
      checkoutIdCliente: null,
    });

    const resultado = sobreporAcoesPendentes([aberta], [acaoCheckout()]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      id: 502,
      status: StatusJornada.FINALIZADA,
      checkoutAt: PAYLOAD_CHECKOUT.registradoEm,
      checkoutLatitude: PAYLOAD_CHECKOUT.latitude,
      checkoutLongitude: PAYLOAD_CHECKOUT.longitude,
      checkoutIdCliente: 'checkout-novo',
    });
  });

  it('check-out pendente some da sobreposição quando a réplica já tem o mesmo checkout_id_cliente', () => {
    const fechada = jornadaDaReplica({ checkoutIdCliente: 'checkout-novo' });
    const outraAberta = jornadaDaReplica({
      id: 503,
      status: StatusJornada.EM_ANDAMENTO,
      checkinAt: '2026-10-18T11:00:00.000Z',
      checkoutAt: null,
      checkinIdCliente: 'checkin-503',
      checkoutIdCliente: null,
    });

    const resultado = sobreporAcoesPendentes([fechada, outraAberta], [acaoCheckout()]);

    // Não fecha a jornada aberta errada: o check-out já está na réplica.
    expect(resultado).toEqual([fechada, outraAberta]);
  });

  it('turno inteiro offline (check-in e check-out na fila) vira uma jornada só, finalizada', () => {
    const resultado = sobreporAcoesPendentes([], [acaoCheckin(), acaoCheckout()]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      status: StatusJornada.FINALIZADA,
      checkinAt: PAYLOAD_CHECKIN.registradoEm,
      checkoutAt: PAYLOAD_CHECKOUT.registradoEm,
      pedidoId: 12,
      checkinIdCliente: 'checkin-novo',
      checkoutIdCliente: 'checkout-novo',
    });
  });

  it('dois check-ins pendentes ganham ids provisórios diferentes', () => {
    const segundo = acaoCheckin({
      idCliente: 'checkin-2',
      payload: { ...PAYLOAD_CHECKIN, idCliente: 'checkin-2' },
      criadoEm: '2026-10-17T12:00:00.000Z',
    });

    const resultado = sobreporAcoesPendentes([], [acaoCheckin(), segundo]);

    expect(resultado).toHaveLength(2);
    expect(new Set(resultado.map((j) => j.id)).size).toBe(2);
  });

  it('check-out pendente sem jornada aberta conhecida é ignorado (o servidor decide quando a fila subir)', () => {
    const resultado = sobreporAcoesPendentes([jornadaDaReplica()], [acaoCheckout()]);

    expect(resultado).toEqual([jornadaDaReplica()]);
  });

  it('não altera os objetos recebidos', () => {
    const aberta = jornadaDaReplica({
      status: StatusJornada.EM_ANDAMENTO,
      checkoutAt: null,
      checkoutIdCliente: null,
    });
    const copia = { ...aberta };

    sobreporAcoesPendentes([aberta], [acaoCheckout()]);

    expect(aberta).toEqual(copia);
  });
});

describe('lerJornadasComPendentes', () => {
  it('lê a réplica e as ações pendentes e enviadas, ignorando descartadas, outros tipos e payload ilegível', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'jornadas', [
      linhaDeJornada({ id: '501', checkin_id_cliente: 'checkin-501', checkout_id_cliente: 'checkout-501' }),
    ]);
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-novo',
      payload: PAYLOAD_CHECKIN,
    });
    await criarAcaoPendente(database, {
      tipo: 'checkout',
      idCliente: 'checkout-novo',
      payload: PAYLOAD_CHECKOUT,
      status: 'enviada',
      criadoEm: '2026-10-17T20:00:01.000Z',
    });
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-recusado',
      payload: { ...PAYLOAD_CHECKIN, idCliente: 'checkin-recusado' },
      status: 'descartada',
    });
    await criarAcaoPendente(database, { tipo: 'avaria', idCliente: 'avaria-1', payload: {} });
    const lixo = await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-lixo',
      payload: {},
    });
    await database.write(() =>
      lixo.update((registro) => {
        registro.payload = '{não é json';
      }),
    );

    const jornadas = await lerJornadasComPendentes(database);

    expect(jornadas.map((j) => j.checkinIdCliente).sort()).toEqual(['checkin-501', 'checkin-novo']);
    const nova = jornadas.find((j) => j.checkinIdCliente === 'checkin-novo')!;
    // O check-out "enviada" ainda não está na réplica: continua sobreposto.
    expect(nova.status).toBe(StatusJornada.FINALIZADA);
    expect(nova.checkoutIdCliente).toBe('checkout-novo');
  });

  it('converte a linha da réplica: id do servidor vira número e pedido_id vira número', async () => {
    const database = criarBancoDeTeste();
    await gravarPullNaReplica(database, syncPullFixture);

    const jornadas = await lerJornadasComPendentes(database);

    const aberta = jornadas.find((j) => j.id === 502)!;
    expect(aberta).toMatchObject({
      usuarioId: 7,
      pedidoId: 12,
      status: StatusJornada.EM_ANDAMENTO,
      checkinIdCliente: '0b6f3c3e-5a0e-4f0b-9d55-1c6f3b0a7a03',
      checkoutIdCliente: null,
    });
    expect(jornadas.find((j) => j.id === 498)!.pedidoId).toBeNull();
  });
});
