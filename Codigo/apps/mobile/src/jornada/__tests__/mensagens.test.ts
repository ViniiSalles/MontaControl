import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { avisoDoResultado } from '../mensagens';

const JORNADA_ABERTA: JornadaDTO = {
  id: 1,
  usuarioId: 10,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-08-29T11:00:00.000Z', // 08:00 local
  checkinLatitude: -19.9325,
  checkinLongitude: -43.9382,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-08-29T11:00:00.000Z',
};

describe('avisoDoResultado', () => {
  it('sucesso cita o tipo e a hora do ponto que acabou de entrar', () => {
    const aviso = avisoDoResultado({ tipo: 'ok', jornada: JORNADA_ABERTA });

    expect(aviso.variante).toBe('sucesso');
    expect(aviso.mensagem).toBe('Ponto de entrada registrado às 08:00.');
  });

  it('check-out bem-sucedido fala em saída', () => {
    const encerrada: JornadaDTO = {
      ...JORNADA_ABERTA,
      status: StatusJornada.FINALIZADA,
      checkoutAt: '2026-08-29T20:00:00.000Z', // 17:00 local
    };

    expect(avisoDoResultado({ tipo: 'ok', jornada: encerrada }).mensagem).toBe(
      'Ponto de saída registrado às 17:00.',
    );
  });

  // Cada motivo tem uma ação diferente para o montador — é o que justifica os
  // quatro desfechos separados em `ResultadoLocalizacao`.
  it.each([
    ['permissao_negada', /ajustes do aparelho/i],
    ['servico_desligado', /ligue o gps/i],
    ['indisponivel', /lugar mais aberto/i],
  ] as const)('falta de localização por %s instrui o que fazer', (motivo, esperado) => {
    const aviso = avisoDoResultado({ tipo: 'sem_localizacao', motivo });

    expect(aviso.variante).toBe('aviso');
    expect(aviso.mensagem).toMatch(esperado);
  });

  it('recusa conhecida da API vira instrução, não eco do código', () => {
    const aviso = avisoDoResultado({ tipo: 'recusado', codigo: 'JORNADA_EM_ANDAMENTO' });

    expect(aviso.variante).toBe('erro');
    expect(aviso.mensagem).toMatch(/jornada aberta/i);
    expect(aviso.mensagem).not.toMatch(/JORNADA_EM_ANDAMENTO/);
  });

  it('recusa desconhecida cai no texto padrão', () => {
    expect(avisoDoResultado({ tipo: 'recusado', codigo: 'ALGO_NOVO' }).mensagem).toMatch(
      /recusado pelo servidor/i,
    );
  });
});
