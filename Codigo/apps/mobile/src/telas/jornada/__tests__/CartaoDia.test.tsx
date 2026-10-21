import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { cores } from '@montacontrol/design-tokens/native';
import { StatusJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO, JornadaDTO } from '@montacontrol/shared';
import { CartaoDia } from '../CartaoDia';

function turno(parcial: Partial<JornadaDTO> & { id: number }): JornadaDTO {
  return {
    usuarioId: 1,
    status: StatusJornada.FINALIZADA,
    checkinAt: null,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-26T11:00:00.000Z',
    ...parcial,
  };
}

function dia(parcial: Partial<DiaJornadaDTO> = {}): DiaJornadaDTO {
  return {
    data: '2026-08-26',
    inicio: '2026-08-26T11:00:00.000Z', // 08:00 local
    fim: '2026-08-26T20:00:00.000Z', // 17:00 local
    minutosTrabalhados: 540,
    emAndamento: false,
    jornadas: [
      turno({
        id: 1,
        checkinAt: '2026-08-26T11:00:00.000Z',
        checkoutAt: '2026-08-26T20:00:00.000Z',
      }),
    ],
    ...parcial,
  };
}

/** 10:00–15:00 e 16:00–18:00 locais, em ordem invertida como o histórico entrega. */
function diaComDoisTurnos(): DiaJornadaDTO {
  return dia({
    minutosTrabalhados: 420,
    jornadas: [
      turno({
        id: 2,
        checkinAt: '2026-08-26T19:00:00.000Z', // 16:00
        checkoutAt: '2026-08-26T21:00:00.000Z', // 18:00
      }),
      turno({
        id: 1,
        checkinAt: '2026-08-26T13:00:00.000Z', // 10:00
        checkoutAt: '2026-08-26T18:00:00.000Z', // 15:00
      }),
    ],
  });
}

describe('CartaoDia', () => {
  it('mostra o dia em destaque com o dia da semana e o total no cabeçalho', async () => {
    await render(<CartaoDia dia={dia()} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText('26 ago')).toBeTruthy();
    expect(screen.getByText('QUARTA-FEIRA')).toBeTruthy();
    expect(screen.getByText('TOTAL')).toBeTruthy();
  });

  it('um turno mostra entrada e saída rotuladas, sem repetir a duração nem numerar o turno', async () => {
    await render(<CartaoDia dia={dia()} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText('ENT.')).toBeTruthy();
    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText('SAÍ.')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
    // A duração do único turno é o total do cabeçalho: aparece uma vez só.
    expect(screen.getAllByText('9h 00min')).toHaveLength(1);
    expect(screen.queryByText('1º TURNO')).toBeNull();
  });

  // O caso que motivou a refatoração: antes o card fundia os dois turnos num
  // único 10:00–18:00, escondendo o intervalo e alongando o dia em uma hora.
  it('dois turnos no mesmo dia aparecem como linhas separadas', async () => {
    await render(<CartaoDia dia={diaComDoisTurnos()} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText('1º TURNO')).toBeTruthy();
    expect(screen.getByText('2º TURNO')).toBeTruthy();

    // Cronológico, e não na ordem em que o histórico entregou.
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('15:00')).toBeTruthy();
    expect(screen.getByText('16:00')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();

    expect(screen.getByText('5h 00min')).toBeTruthy();
    expect(screen.getByText('2h 00min')).toBeTruthy();
    // Total do cabeçalho: soma dos turnos, não a distância entre 10:00 e 18:00 (que daria 8h).
    expect(screen.getByText('7h 00min')).toBeTruthy();
  });

  it('turno aberto recente aparece em andamento, com travessão na saída', async () => {
    const agora = Date.now();
    const emCurso = dia({
      minutosTrabalhados: 0,
      emAndamento: true,
      jornadas: [
        turno({
          id: 1,
          status: StatusJornada.EM_ANDAMENTO,
          checkinAt: new Date(agora - 2 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });

    await render(<CartaoDia dia={emCurso} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText('—')).toBeTruthy();
    // Badge sempre renderiza `texto.toUpperCase()` (ver `src/ui/Badge.tsx`).
    expect(screen.getByText(/em andamento/i)).toBeTruthy();
    expect(screen.queryByText(/sem sa[íi]da/i)).toBeNull();
  });

  it('turno aberto além de 24h aparece como sem saída, não em andamento', async () => {
    const vencido = dia({
      minutosTrabalhados: 0,
      emAndamento: true,
      jornadas: [
        turno({
          id: 1,
          status: StatusJornada.EM_ANDAMENTO,
          checkinAt: '2026-08-26T11:00:00.000Z',
        }),
      ],
    });

    await render(<CartaoDia dia={vencido} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText(/sem sa[íi]da/i)).toBeTruthy();
    expect(screen.queryByText(/em andamento/i)).toBeNull();
  });

  it('dia com turno sem saída oferece o atalho de ponto em atraso com a data do card', async () => {
    const aoLancar = jest.fn();
    const semSaida = dia({
      emAndamento: true,
      jornadas: [
        turno({
          id: 1,
          status: StatusJornada.EM_ANDAMENTO,
          checkinAt: '2026-08-26T11:00:00.000Z',
        }),
      ],
    });

    await render(<CartaoDia dia={semSaida} aoLancarEmAtraso={aoLancar} />);
    await fireEvent.press(screen.getByText('Lançar ponto em atraso'));

    expect(aoLancar).toHaveBeenCalledWith('2026-08-26');
  });

  it('jornada lançada em atraso ganha badge próprio', async () => {
    const comAtraso = dia({
      jornadas: [
        turno({
          id: 1,
          checkinAt: '2026-08-26T11:00:00.000Z',
          checkoutAt: '2026-08-26T20:00:00.000Z',
          lancadoEmAtraso: true,
        }),
      ],
    });

    await render(<CartaoDia dia={comAtraso} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText(/em atraso/i)).toBeTruthy();
  });
});

describe('CartaoDia — faixa de destaque', () => {
  const corDoDestaque = () =>
    StyleSheet.flatten(screen.getByTestId('cartao-dia').props.style).borderLeftColor;

  it('dia regular usa o primário', async () => {
    await render(<CartaoDia dia={dia()} aoLancarEmAtraso={jest.fn()} />);
    expect(corDoDestaque()).toBe(cores.primary);
  });

  it('dia com ponto lançado em atraso usa o terciário', async () => {
    const comAtraso = dia({
      jornadas: [
        turno({
          id: 1,
          checkinAt: '2026-08-26T11:00:00.000Z',
          checkoutAt: '2026-08-26T20:00:00.000Z',
          lancadoEmAtraso: true,
        }),
      ],
    });
    await render(<CartaoDia dia={comAtraso} aoLancarEmAtraso={jest.fn()} />);
    expect(corDoDestaque()).toBe(cores.tertiary);
  });

  // Sem saída é o que pede ação: ganha do "em atraso" quando os dois aparecem.
  it('dia com turno sem saída usa o erro', async () => {
    const vencido = dia({
      emAndamento: true,
      jornadas: [
        turno({
          id: 1,
          status: StatusJornada.EM_ANDAMENTO,
          checkinAt: '2026-08-26T11:00:00.000Z',
          lancadoEmAtraso: true,
        }),
      ],
    });
    await render(<CartaoDia dia={vencido} aoLancarEmAtraso={jest.fn()} />);
    expect(corDoDestaque()).toBe(cores.error);
  });
});
