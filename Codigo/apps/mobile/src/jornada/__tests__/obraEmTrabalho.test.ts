import { StatusJornada } from '@montacontrol/shared';
import type { ObraDoPonto } from '../../pedidos/obras';
import type { JornadaExibida } from '../jornadasComPendentes';
import { obraEmTrabalho } from '../obraEmTrabalho';

const AGORA = '2026-10-14T17:00:00.000Z';
const HA_2H = '2026-10-14T15:00:00.000Z';
const HA_30H = '2026-10-13T11:00:00.000Z';

const OBRA: ObraDoPonto = {
  id: 12,
  numeroPedido: 'PED-000012',
  cliente: {
    nome: 'Maria Souza',
    endereco: 'Av. Afonso Pena, 1000',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    latitude: -19.93,
    longitude: -43.93,
  },
};

function jornada(parcial: Partial<JornadaExibida> = {}): JornadaExibida {
  return {
    id: 1,
    usuarioId: 7,
    status: StatusJornada.EM_ANDAMENTO,
    checkinAt: HA_2H,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: HA_2H,
    pedidoId: 12,
    checkinIdCliente: null,
    checkoutIdCliente: null,
    ...parcial,
  };
}

describe('obraEmTrabalho', () => {
  it('jornada em andamento com obra da réplica: é a obra em trabalho', () => {
    expect(obraEmTrabalho(jornada(), [OBRA], AGORA)).toEqual({ obra: OBRA, motivo: null });
  });

  it('sem jornada: sem ponto', () => {
    expect(obraEmTrabalho(null, [OBRA], AGORA)).toEqual({ obra: null, motivo: 'sem_ponto' });
  });

  // `useJornadaAtual` devolve o último turno encerrado hoje quando não há aberto.
  it('jornada encerrada: sem ponto', () => {
    const encerrada = jornada({ status: StatusJornada.FINALIZADA, checkoutAt: AGORA });
    expect(obraEmTrabalho(encerrada, [OBRA], AGORA)).toEqual({ obra: null, motivo: 'sem_ponto' });
  });

  it('entrada há mais de 24h sem saída: jornada vencida, não vale como presença', () => {
    const vencida = jornada({ checkinAt: HA_30H, criadoEm: HA_30H });
    expect(obraEmTrabalho(vencida, [OBRA], AGORA)).toEqual({
      obra: null,
      motivo: 'jornada_vencida',
    });
  });

  it('jornada em andamento sem obra (dado antigo): sem obra vinculada', () => {
    expect(obraEmTrabalho(jornada({ pedidoId: null }), [OBRA], AGORA)).toEqual({
      obra: null,
      motivo: 'sem_obra_vinculada',
    });
  });

  it('obra do ponto que não está na réplica: fora da réplica', () => {
    expect(obraEmTrabalho(jornada({ pedidoId: 99 }), [OBRA], AGORA)).toEqual({
      obra: null,
      motivo: 'obra_fora_da_replica',
    });
  });
});
