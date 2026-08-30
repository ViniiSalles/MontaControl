import { render, screen } from '@testing-library/react-native';
import { CartaoUltimoPonto } from '../CartaoUltimoPonto';
import type { UltimoPonto } from '../../../jornada/ultimoPonto';

function ponto(parcial: Partial<UltimoPonto> = {}): UltimoPonto {
  return {
    tipo: 'entrada',
    registradoEm: '2026-08-26T11:00:00.000Z', // 08:00 local
    latitude: -19.9325,
    longitude: -43.9382,
    endereco: 'Av. Afonso Pena, 1000',
    lancadoEmAtraso: false,
    ...parcial,
  };
}

describe('CartaoUltimoPonto', () => {
  it('sem ponto, orienta a bater a entrada', async () => {
    await render(<CartaoUltimoPonto ponto={null} estado="finalizada" />);

    expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy();
    expect(screen.queryByText('08:00')).toBeNull();
  });

  it('mostra hora, tipo e badge de jornada aberta no check-in', async () => {
    await render(<CartaoUltimoPonto ponto={ponto()} estado="em_andamento" />);

    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText(/^Entrada ·/)).toBeTruthy();
    // Badge renderiza `texto.toUpperCase()` (ver `src/ui/Badge.tsx`).
    expect(screen.getByText(/em andamento/i)).toBeTruthy();
    expect(screen.getByTestId('pulso-atividade')).toBeTruthy();
  });

  it('check-out troca o badge e apaga o pulso de atividade', async () => {
    await render(
      <CartaoUltimoPonto
        ponto={ponto({ tipo: 'saida', registradoEm: '2026-08-26T20:00:00.000Z' })}
        estado="finalizada"
      />,
    );

    expect(screen.getByText('17:00')).toBeTruthy();
    expect(screen.getByText(/^Saída ·/)).toBeTruthy();
    expect(screen.getByText(/encerrada/i)).toBeTruthy();
    expect(screen.queryByTestId('pulso-atividade')).toBeNull();
  });

  // Entrada que passou de 24h sem saída não é turno em curso: o selo, o pulso
  // e o texto precisam dizer isso, senão o montador acha que ainda está rodando.
  it('jornada vencida mostra "sem saída" e explica o caminho da correção', async () => {
    await render(<CartaoUltimoPonto ponto={ponto()} estado="vencida" />);

    // Texto exato no selo: o parágrafo de explicação abaixo também contém
    // "sem saída", e um regex casaria com os dois nós.
    expect(screen.getByText('SEM SAÍDA')).toBeTruthy();
    expect(screen.getByText(/passou de 24h/i)).toBeTruthy();
    expect(screen.getByText(/ponto em atraso/i)).toBeTruthy();
    expect(screen.queryByTestId('pulso-atividade')).toBeNull();
  });

  it('ponto sem coordenada não renderiza mapa', async () => {
    await render(
      <CartaoUltimoPonto
        ponto={ponto({ latitude: null, longitude: null, endereco: null, lancadoEmAtraso: true })}
        estado="finalizada"
      />,
    );

    expect(screen.queryByTestId('mapa-webview')).toBeNull();
    expect(screen.getByText(/em atraso/i)).toBeTruthy();
  });

  it('ponto com coordenada mostra o endereço resolvido', async () => {
    await render(<CartaoUltimoPonto ponto={ponto()} estado="em_andamento" />);

    expect(screen.getByText('Av. Afonso Pena, 1000')).toBeTruthy();
  });
});
