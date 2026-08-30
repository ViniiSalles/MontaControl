import { render, screen } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import type { DiaJornadaDTO } from '@montacontrol/shared';
import { CartaoDia } from '../CartaoDia';

function dia(parcial: Partial<DiaJornadaDTO> = {}): DiaJornadaDTO {
  return {
    data: '2026-08-26',
    inicio: '2026-08-26T11:00:00.000Z', // 08:00 local
    fim: '2026-08-26T20:00:00.000Z', // 17:00 local
    minutosTrabalhados: 540,
    emAndamento: false,
    jornadas: [],
    ...parcial,
  };
}

describe('CartaoDia', () => {
  it('mostra início, fim e total do dia', async () => {
    await render(<CartaoDia dia={dia()} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
    expect(screen.getByText('9h 00min')).toBeTruthy();
  });

  it('dia em andamento mostra travessão no fim e badge', async () => {
    await render(<CartaoDia dia={dia({ fim: null, emAndamento: true })} aoLancarEmAtraso={jest.fn()} />);

    expect(screen.getByText('—')).toBeTruthy();
    // Badge (`src/ui/Badge.tsx`) sempre renderiza `texto.toUpperCase()` — é
    // desenho intencional do design system (`labelSm` uppercase, ver
    // `packages/ui-contracts/src/badge.ts`), não um detalhe de estilo via CSS.
    // Por isso o texto vem case-insensitive aqui, e não como o literal do brief.
    expect(screen.getByText(/em andamento/i)).toBeTruthy();
  });

  it('jornada lançada em atraso ganha badge próprio', async () => {
    const comAtraso = dia({
      jornadas: [
        {
          id: 1,
          usuarioId: 1,
          status: StatusJornada.FINALIZADA,
          checkinAt: '2026-08-26T11:00:00.000Z',
          checkinLatitude: null,
          checkinLongitude: null,
          checkinEndereco: null,
          checkoutAt: '2026-08-26T20:00:00.000Z',
          checkoutLatitude: null,
          checkoutLongitude: null,
          checkoutEndereco: null,
          lancadoEmAtraso: true,
        },
      ],
    });

    await render(<CartaoDia dia={comAtraso} aoLancarEmAtraso={jest.fn()} />);

    // Ver nota acima: Badge uppercases o texto.
    expect(screen.getByText(/em atraso/i)).toBeTruthy();
  });
});
