import { render, screen } from '@testing-library/react-native';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { CartaoUltimoPonto } from '../CartaoUltimoPonto';

function jornada(parcial: Partial<JornadaDTO> = {}): JornadaDTO {
  return {
    id: 1,
    usuarioId: 1,
    status: StatusJornada.EM_ANDAMENTO,
    checkinAt: '2026-08-26T11:00:00.000Z', // 08:00 local
    checkinLatitude: -19.9325,
    checkinLongitude: -43.9382,
    checkinEndereco: 'Av. Afonso Pena, 1000',
    checkoutAt: null,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: '2026-08-26T11:00:00.000Z',
    ...parcial,
  };
}

describe('CartaoUltimoPonto', () => {
  it('sem jornada, orienta a bater a entrada', async () => {
    await render(<CartaoUltimoPonto jornada={null} estado="finalizada" />);

    expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy();
    expect(screen.queryByText('08:00')).toBeNull();
  });

  it('só com check-in, mostra a entrada concluída e a saída pendente pulsando', async () => {
    await render(<CartaoUltimoPonto jornada={jornada()} estado="em_andamento" />);

    expect(screen.getByText('08:00')).toBeTruthy();
    // Badge renderiza `texto.toUpperCase()` (ver `src/ui/Badge.tsx`).
    expect(screen.getByText(/em andamento/i)).toBeTruthy();
    expect(screen.getByText('Av. Afonso Pena, 1000')).toBeTruthy();
    expect(screen.getByTestId('pulso-atividade')).toBeTruthy();
  });

  it('com check-out, mostra as duas marcações e apaga o pulso de atividade', async () => {
    await render(
      <CartaoUltimoPonto
        jornada={jornada({
          status: StatusJornada.FINALIZADA,
          checkoutAt: '2026-08-26T20:00:00.000Z', // 17:00 local
          checkoutLatitude: -19.94,
          checkoutLongitude: -43.94,
          checkoutEndereco: 'Rua da Bahia, 200',
        })}
        estado="finalizada"
      />,
    );

    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText('17:00')).toBeTruthy();
    expect(screen.getByText(/encerrada/i)).toBeTruthy();
    // O mapa segue o último ponto — agora é o de check-out.
    expect(screen.getByText('Rua da Bahia, 200')).toBeTruthy();
    expect(screen.queryByTestId('pulso-atividade')).toBeNull();
  });

  // Entrada que passou de 24h sem saída não é turno em curso: o selo, o pulso
  // e o texto precisam dizer isso, senão o montador acha que ainda está rodando.
  it('jornada vencida mostra "sem saída", apaga o pulso e explica o caminho da correção', async () => {
    await render(<CartaoUltimoPonto jornada={jornada()} estado="vencida" />);

    // Texto exato no selo: o parágrafo de explicação abaixo também contém
    // "sem saída", e um regex casaria com os dois nós.
    expect(screen.getByText('SEM SAÍDA')).toBeTruthy();
    expect(screen.getByText(/passou de 24h/i)).toBeTruthy();
    expect(screen.getByText(/ponto em atraso/i)).toBeTruthy();
    expect(screen.queryByTestId('pulso-atividade')).toBeNull();
  });

  it('ponto lançado em atraso ganha badge próprio e sem coordenada não renderiza mapa', async () => {
    await render(
      <CartaoUltimoPonto
        jornada={jornada({
          checkinLatitude: null,
          checkinLongitude: null,
          checkinEndereco: null,
          lancadoEmAtraso: true,
        })}
        estado="em_andamento"
      />,
    );

    expect(screen.queryByTestId('mapa-webview')).toBeNull();
    expect(screen.getByText(/em atraso/i)).toBeTruthy();
  });
});
