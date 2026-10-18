jest.mock('../../jornada/clienteJornadas', () => {
  return {
    enviarCheckin: jest.fn(),
    enviarCheckout: jest.fn(),
    enviarSolicitacaoPonto: jest.fn(),
  };
});
jest.mock('../../avarias/clienteAvarias', () => ({ enviarAvaria: jest.fn() }));
jest.mock('../../atestados/clienteAtestados', () => ({ enviarAtestado: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import { StatusJornada, type JornadaDTO } from '@montacontrol/shared';
import { enviarAtestado } from '../../atestados/clienteAtestados';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { ErroApi } from '../../http/erroApi';
import { criarAcaoPendente, criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import {
  enviarCheckin,
  enviarCheckout,
  enviarSolicitacaoPonto,
} from '../../jornada/clienteJornadas';
import { lerJornadasComPendentes } from '../../jornada/jornadasComPendentes';
import { drenarFila } from '../syncManager';

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

const CHECKIN_PAYLOAD = (idCliente: string, registradoEm: string) => ({
  idCliente,
  latitude: -19.9,
  longitude: -43.9,
  registradoEm,
  pedidoId: 10,
});

const comStatus = (database: ReturnType<typeof criarBancoDeTeste>, status: string) =>
  database.get<AcaoPendente>('acoes_pendentes').query(Q.where('status', status)).fetch();

describe('drenarFila', () => {
  beforeEach(() => jest.clearAllMocks());

  it('check-in aceito: a ação vira "enviada" (a jornada só entra com o pull) e a tela segue com UMA jornada', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockResolvedValue(jornadaFalsa({ id: 99 }));
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
    });

    await drenarFila(database);

    expect(await comStatus(database, 'pendente')).toHaveLength(0);
    expect(await comStatus(database, 'enviada')).toHaveLength(1);
    // A réplica não é escrita pela drenagem.
    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
    expect(await lerJornadasComPendentes(database)).toHaveLength(1);
  });

  it('avaria e atestado aceitos ficam `enviada` até o pull (a lista não os perde); ponto em atraso sai da fila', async () => {
    const database = criarBancoDeTeste();
    (enviarAvaria as jest.Mock).mockResolvedValue({});
    (enviarAtestado as jest.Mock).mockResolvedValue({});
    (enviarSolicitacaoPonto as jest.Mock).mockResolvedValue({});
    await criarAcaoPendente(database, {
      tipo: 'avaria',
      idCliente: 'avaria-1',
      payload: { idCliente: 'avaria-1' },
      criadoEm: '2026-09-09T12:00:00.000Z',
    });
    await criarAcaoPendente(database, {
      tipo: 'atestado',
      idCliente: 'atestado-1',
      payload: { idCliente: 'atestado-1', fotos: [{ conteudoBase64: 'x', mimeType: 'image/jpeg' }] },
      criadoEm: '2026-09-09T12:30:00.000Z',
    });
    await criarAcaoPendente(database, {
      tipo: 'ponto_em_atraso',
      idCliente: 'ponto-1',
      payload: { idCliente: 'ponto-1' },
      criadoEm: '2026-09-09T13:00:00.000Z',
    });

    await drenarFila(database);

    expect(await comStatus(database, 'pendente')).toHaveLength(0);
    const enviadas = await comStatus(database, 'enviada');
    expect(enviadas.map((acao) => acao.tipo).sort()).toEqual(['atestado', 'avaria']);
  });

  it('recusa 4xx: marca descartada com a mensagem, sem parar a fila', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(
      new ErroApi('JORNADA_EM_ANDAMENTO', 'Já existe uma jornada em andamento.', 409),
    );
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
    });

    await drenarFila(database);

    const descartadas = await comStatus(database, 'descartada');
    expect(descartadas).toHaveLength(1);
    expect(descartadas[0].mensagemDescarte).toContain('JORNADA_EM_ANDAMENTO');
    // Descartada não é sobreposta na tela.
    expect(await lerJornadasComPendentes(database)).toHaveLength(0);
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
    await criarAcaoPendente(database, {
      tipo: 'checkout',
      idCliente: 'id-2',
      payload: { idCliente: 'id-2', latitude: -19.9, longitude: -43.9, registradoEm: '2026-09-09T18:00:00.000Z' },
      criadoEm: '2026-09-09T18:00:00.000Z',
    });
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
      criadoEm: '2026-09-09T12:00:00.000Z',
    });

    await drenarFila(database);

    expect(ordem).toEqual(['checkin', 'checkout']);
  });

  it('falha de rede: para a drenagem sem descartar nem pular à frente', async () => {
    const database = criarBancoDeTeste();
    (enviarCheckin as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
      criadoEm: '2026-09-09T12:00:00.000Z',
    });
    await criarAcaoPendente(database, {
      tipo: 'checkout',
      idCliente: 'id-2',
      payload: { idCliente: 'id-2', latitude: -19.9, longitude: -43.9, registradoEm: '2026-09-09T18:00:00.000Z' },
      criadoEm: '2026-09-09T18:00:00.000Z',
    });

    await drenarFila(database);

    expect(await comStatus(database, 'pendente')).toHaveLength(2);
    expect(enviarCheckout).not.toHaveBeenCalled();
  });

  it('ação já "enviada" não é reenviada', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
      status: 'enviada',
    });

    await drenarFila(database);

    expect(enviarCheckin).not.toHaveBeenCalled();
  });

  it('linha que deixou de estar pendente durante a drenagem (envio imediato da tela) não é reenviada', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
      criadoEm: '2026-09-09T12:00:00.000Z',
    });
    const segunda = await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-2',
      payload: CHECKIN_PAYLOAD('id-2', '2026-09-09T13:00:00.000Z'),
      criadoEm: '2026-09-09T13:00:00.000Z',
    });
    // Enquanto a 1ª sobe, o envio imediato da tela confirma a 2ª.
    (enviarCheckin as jest.Mock).mockImplementationOnce(async () => {
      await database.write(() =>
        segunda.update((registro) => {
          registro.status = 'enviada';
        }),
      );
      return {};
    });

    await drenarFila(database);

    expect(enviarCheckin).toHaveBeenCalledTimes(1);
  });

  it('linha apagada durante a drenagem (recusa do envio imediato da tela) não é reenviada nem derruba a drenagem', async () => {
    const database = criarBancoDeTeste();
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-1',
      payload: CHECKIN_PAYLOAD('id-1', '2026-09-09T12:00:00.000Z'),
      criadoEm: '2026-09-09T12:00:00.000Z',
    });
    const segunda = await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'id-2',
      payload: CHECKIN_PAYLOAD('id-2', '2026-09-09T13:00:00.000Z'),
      criadoEm: '2026-09-09T13:00:00.000Z',
    });
    (enviarCheckin as jest.Mock).mockImplementationOnce(async () => {
      await database.write(() => segunda.destroyPermanently());
      return {};
    });

    await expect(drenarFila(database)).resolves.toBeUndefined();

    expect(enviarCheckin).toHaveBeenCalledTimes(1);
  });
});
