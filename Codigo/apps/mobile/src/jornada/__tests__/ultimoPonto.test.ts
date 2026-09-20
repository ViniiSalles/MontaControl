import { StatusJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO, JornadaDTO } from '@montacontrol/shared';
import { derivarUltimoPonto, minutosTrabalhadosHoje, proximaAcao } from '../ultimoPonto';

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

// Check-in às 08:00 locais do dia 29; o limite de 24h cai às 08:00 do dia 30.
const DENTRO_DO_LIMITE = '2026-08-29T22:00:00.000Z';
const DEPOIS_DO_LIMITE = '2026-08-30T12:00:00.000Z';

describe('proximaAcao', () => {
  it('sem jornada, a próxima ação é a entrada', () => {
    expect(proximaAcao(null, DENTRO_DO_LIMITE)).toBe('entrada');
  });

  it('jornada aberta dentro do limite pede saída', () => {
    expect(proximaAcao(jornada(), DENTRO_DO_LIMITE)).toBe('saida');
  });

  // O que decide é `checkoutAt`, não `status`: uma jornada PAUSADA continua
  // aberta e o botão precisa seguir oferecendo a saída.
  it('jornada pausada continua pedindo saída', () => {
    expect(proximaAcao(jornada({ status: StatusJornada.PAUSADA }), DENTRO_DO_LIMITE)).toBe('saida');
  });

  it('jornada com check-out volta a pedir entrada', () => {
    const encerrada = jornada({
      status: StatusJornada.FINALIZADA,
      checkoutAt: '2026-08-29T20:00:00.000Z',
    });
    expect(proximaAcao(encerrada, DENTRO_DO_LIMITE)).toBe('entrada');
  });

  // O caso da refatoração: check-out esquecido não pode prender o montador
  // oferecendo uma saída que a API vai recusar — o dia de hoje começa com
  // uma entrada nova.
  it('jornada aberta além das 24h vence e volta a pedir entrada', () => {
    expect(proximaAcao(jornada(), DEPOIS_DO_LIMITE)).toBe('entrada');
  });
});

describe('minutosTrabalhadosHoje', () => {
  // Turno 1: 08:00–12:00 locais (240min), já fechado.
  const TURNO_1 = jornada({
    id: 1,
    status: StatusJornada.FINALIZADA,
    checkinAt: '2026-08-29T11:00:00.000Z',
    checkoutAt: '2026-08-29T15:00:00.000Z',
  });
  // Turno 2: abre 14:00 local, ainda sem check-out.
  const TURNO_2_ABERTO = jornada({ id: 2, checkinAt: '2026-08-29T17:00:00.000Z' });
  // "Agora" 15:30 local — 1h30 (90min) de turno 2 em curso.
  const AGORA = '2026-08-29T18:30:00.000Z';

  function diaComTurnos(...jornadas: JornadaDTO[]): DiaJornadaDTO {
    return {
      data: '2026-08-29',
      inicio: jornadas[0]?.checkinAt ?? null,
      fim: null,
      minutosTrabalhados: 0, // não usado por `minutosTrabalhadosHoje` — recalcula de `.jornadas`
      emAndamento: true,
      jornadas,
    };
  }

  it('sem nenhum turno hoje, não há o que somar', () => {
    expect(minutosTrabalhadosHoje(null, null, 'finalizada', AGORA)).toBeNull();
  });

  it('jornada vencida não soma — duração bruta de +24h não é "hoje"', () => {
    const dia = diaComTurnos(TURNO_1, TURNO_2_ABERTO);
    expect(minutosTrabalhadosHoje(dia, TURNO_2_ABERTO, 'vencida', AGORA)).toBeNull();
  });

  it('histórico ainda não carregado, soma só o turno em curso', () => {
    expect(minutosTrabalhadosHoje(null, TURNO_2_ABERTO, 'em_andamento', AGORA)).toBe(90);
  });

  // O caso do bug reportado: reabrir um turno no mesmo dia não pode "esquecer"
  // o turno anterior já fechado.
  it('soma o turno anterior fechado (do histórico) com o turno em curso', () => {
    const dia = diaComTurnos(TURNO_1, TURNO_2_ABERTO);
    expect(minutosTrabalhadosHoje(dia, TURNO_2_ABERTO, 'em_andamento', AGORA)).toBe(240 + 90);
  });

  // Mesmo resultado mesmo se o histórico ainda não sabe do turno 2 (não foi
  // recarregado desde que ele abriu) — a tela usa a versão fresca que já tem
  // em mãos (`jornadaExibida`) em vez de esperar o histórico se atualizar.
  it('soma corretamente mesmo com histórico desatualizado sobre o turno atual', () => {
    const diaDesatualizado = diaComTurnos(TURNO_1);
    expect(minutosTrabalhadosHoje(diaDesatualizado, TURNO_2_ABERTO, 'em_andamento', AGORA)).toBe(
      240 + 90,
    );
  });

  it('turno atual encerrado soma pela duração real, não pelo relógio', () => {
    const turno2Fechado = jornada({
      id: 2,
      status: StatusJornada.FINALIZADA,
      checkinAt: '2026-08-29T17:00:00.000Z',
      checkoutAt: '2026-08-29T18:00:00.000Z', // 1h
    });
    const dia = diaComTurnos(TURNO_1);
    expect(minutosTrabalhadosHoje(dia, turno2Fechado, 'finalizada', AGORA)).toBe(240 + 60);
  });
});
