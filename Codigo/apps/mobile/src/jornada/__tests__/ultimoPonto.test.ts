import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { derivarUltimoPonto, proximaAcao } from '../ultimoPonto';

function jornada(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: 10,
    status: StatusJornada.EM_ANDAMENTO,
    checkinAt: '2026-08-29T11:00:00.000Z', // 08:00 local
    checkinLatitude: -19.9325,
    checkinLongitude: -43.9382,
    checkinEndereco: 'Av. Afonso Pena, 1000',
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-29T11:00:00.000Z',
    ...parcial,
  };
}

describe('derivarUltimoPonto', () => {
  it('sem jornada não há ponto', () => {
    expect(derivarUltimoPonto(null)).toBeNull();
  });

  it('jornada aberta devolve o check-in', () => {
    expect(derivarUltimoPonto(jornada())).toEqual({
      tipo: 'entrada',
      registradoEm: '2026-08-29T11:00:00.000Z',
      latitude: -19.9325,
      longitude: -43.9382,
      endereco: 'Av. Afonso Pena, 1000',
      lancadoEmAtraso: false,
    });
  });

  it('jornada encerrada devolve o check-out, não o check-in', () => {
    const encerrada = jornada({
      status: StatusJornada.FINALIZADA,
      checkoutAt: '2026-08-29T20:00:00.000Z',
      checkoutLatitude: -19.94,
      checkoutLongitude: -43.94,
      checkoutEndereco: 'Rua da Bahia, 200',
    });

    expect(derivarUltimoPonto(encerrada)).toMatchObject({
      tipo: 'saida',
      registradoEm: '2026-08-29T20:00:00.000Z',
      endereco: 'Rua da Bahia, 200',
    });
  });

  it('ponto lançado em atraso não tem coordenada e o campo acompanha', () => {
    const emAtraso = jornada({
      lancadoEmAtraso: true,
      checkinLatitude: null,
      checkinLongitude: null,
      checkinEndereco: null,
    });

    expect(derivarUltimoPonto(emAtraso)).toMatchObject({
      lancadoEmAtraso: true,
      latitude: null,
      longitude: null,
    });
  });
});

describe('proximaAcao', () => {
  it('sem jornada, a próxima ação é a entrada', () => {
    expect(proximaAcao(null)).toBe('entrada');
  });

  it('jornada sem check-out pede saída', () => {
    expect(proximaAcao(jornada())).toBe('saida');
  });

  // O que decide é `checkoutAt`, não `status`: uma jornada PAUSADA continua
  // aberta e o botão precisa seguir oferecendo a saída.
  it('jornada pausada continua pedindo saída', () => {
    expect(proximaAcao(jornada({ status: StatusJornada.PAUSADA }))).toBe('saida');
  });

  it('jornada com check-out volta a pedir entrada', () => {
    const encerrada = jornada({
      status: StatusJornada.FINALIZADA,
      checkoutAt: '2026-08-29T20:00:00.000Z',
    });
    expect(proximaAcao(encerrada)).toBe('entrada');
  });
});
