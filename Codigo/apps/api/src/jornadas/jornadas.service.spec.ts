import { Test } from '@nestjs/testing';
import { StatusJornada } from '@montacontrol/shared';
import type { CheckinRequest, JornadaDTO } from '@montacontrol/shared';
import { JornadasRepository } from './jornadas.repository';
import { JornadasService } from './jornadas.service';
import { JornadaEmAndamentoException } from './exceptions/jornada-em-andamento.exception';
import { RegistroForaDaJanelaException } from './exceptions/registro-fora-da-janela.exception';

const USUARIO_ID = 7;

/** 26/08/2026 14:00 em America/Sao_Paulo (17:00Z) — "agora" congelado em todos os testes. */
const AGORA = new Date('2026-08-26T17:00:00.000Z');

function jornadaFake(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: USUARIO_ID,
    status: StatusJornada.EM_ANDAMENTO,
    checkinAt: '2026-08-26T11:00:00.000Z',
    checkinLatitude: -19.9325,
    checkinLongitude: -43.9382,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-26T10:00:00.000Z',
    ...parcial,
  };
}

function pedido(parcial: Partial<CheckinRequest> = {}): CheckinRequest {
  return {
    idCliente: '11111111-1111-4111-8111-111111111111',
    latitude: -19.9325,
    longitude: -43.9382,
    registradoEm: '2026-08-26T16:00:00.000Z', // 13:00 local, hoje
    ...parcial,
  };
}

describe('JornadasService — check-in', () => {
  let service: JornadasService;
  let repositorio: jest.Mocked<JornadasRepository>;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    const duplo: Partial<jest.Mocked<JornadasRepository>> = {
      buscarPorCheckinIdCliente: jest.fn().mockResolvedValue(null),
      buscarAbertaDoUsuario: jest.fn().mockResolvedValue(null),
      criarCheckin: jest.fn().mockResolvedValue(jornadaFake()),
    };

    const modulo = await Test.createTestingModule({
      providers: [JornadasService, { provide: JornadasRepository, useValue: duplo }],
    }).compile();

    service = modulo.get(JornadasService);
    repositorio = modulo.get(JornadasRepository);
    jest.clearAllMocks();
  });

  it('cria a jornada quando não há nenhuma aberta', async () => {
    repositorio.criarCheckin.mockResolvedValue(jornadaFake());

    const resultado = await service.checkin(USUARIO_ID, pedido());

    expect(resultado.id).toBe(1);
    expect(repositorio.criarCheckin).toHaveBeenCalledTimes(1);
  });

  it('grava o horário do aparelho, não a hora de chegada na API', async () => {
    await service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-26T12:34:00.000Z' }));

    expect(repositorio.criarCheckin).toHaveBeenCalledWith(
      expect.objectContaining({ checkinAt: new Date('2026-08-26T12:34:00.000Z') }),
    );
  });

  it('idCliente repetido devolve a jornada existente e não cria outra', async () => {
    repositorio.buscarPorCheckinIdCliente.mockResolvedValue(jornadaFake({ id: 42 }));

    const resultado = await service.checkin(USUARIO_ID, pedido());

    expect(resultado.id).toBe(42);
    expect(repositorio.criarCheckin).not.toHaveBeenCalled();
  });

  it('recusa quando já existe jornada aberta', async () => {
    repositorio.buscarAbertaDoUsuario.mockResolvedValue(jornadaFake());

    await expect(service.checkin(USUARIO_ID, pedido())).rejects.toBeInstanceOf(
      JornadaEmAndamentoException,
    );
    expect(repositorio.criarCheckin).not.toHaveBeenCalled();
  });

  it('recusa registro mais de 5 minutos no futuro', async () => {
    await expect(
      service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-26T18:00:00.000Z' })),
    ).rejects.toBeInstanceOf(RegistroForaDaJanelaException);
  });

  it('aceita registro alguns minutos no futuro (desvio de relógio)', async () => {
    await expect(
      service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-26T17:03:00.000Z' })),
    ).resolves.toBeDefined();
  });

  it('aceita registro de ontem — aparelho que passou a noite sem rede', async () => {
    await expect(
      service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-25T20:00:00.000Z' })),
    ).resolves.toBeDefined();
  });

  it('aceita 23h de ontem no fuso local, mesmo já sendo hoje em UTC', async () => {
    // 25/08 23:00 local = 26/08 02:00Z
    await expect(
      service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-26T02:00:00.000Z' })),
    ).resolves.toBeDefined();
  });

  it('recusa registro de anteontem', async () => {
    await expect(
      service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-24T20:00:00.000Z' })),
    ).rejects.toBeInstanceOf(RegistroForaDaJanelaException);
  });

  it('avalia o dia no fuso de operação, não em UTC', async () => {
    // 24/08 23:00 no horário de Brasília é 25/08 02:00Z. Em UTC o dia seria
    // 25/08, que está na janela; no fuso de operação é 24/08 — anteontem —
    // e precisa ser recusado. É o único caso que separa as duas leituras.
    await expect(
      service.checkin(USUARIO_ID, pedido({ registradoEm: '2026-08-25T02:00:00.000Z' })),
    ).rejects.toBeInstanceOf(RegistroForaDaJanelaException);
  });
});
