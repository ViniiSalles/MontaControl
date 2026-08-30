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
    await render(<CartaoUltimoPonto ponto={null} />);

    expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy();
    expect(screen.queryByText('08:00')).toBeNull();
  });

  it('mostra hora, tipo e badge de jornada aberta no check-in', async () => {
    await render(<CartaoUltimoPonto ponto={ponto()} />);

    expect(screen.getByText('08:00')).toBeTruthy();
    expect(screen.getByText(/^Entrada ·/)).toBeTruthy();
    // Badge renderiza `texto.toUpperCase()` (ver `src/ui/Badge.tsx`).
    expect(screen.getByText(/em andamento/i)).toBeTruthy();
    expect(screen.getByTestId('pulso-atividade')).toBeTruthy();
  });

  it('check-out troca o badge e apaga o pulso de atividade', async () => {
    await render(
      <CartaoUltimoPonto ponto={ponto({ tipo: 'saida', registradoEm: '2026-08-26T20:00:00.000Z' })} />,
    );

    expect(screen.getByText('17:00')).toBeTruthy();
    expect(screen.getByText(/^Saída ·/)).toBeTruthy();
    expect(screen.getByText(/encerrada/i)).toBeTruthy();
    expect(screen.queryByTestId('pulso-atividade')).toBeNull();
  });

  it('ponto sem coordenada não renderiza mapa', async () => {
    await render(
      <CartaoUltimoPonto
        ponto={ponto({ latitude: null, longitude: null, endereco: null, lancadoEmAtraso: true })}
      />,
    );

    expect(screen.queryByTestId('mapa-webview')).toBeNull();
    expect(screen.getByText(/em atraso/i)).toBeTruthy();
  });

  it('ponto com coordenada mostra o endereço resolvido', async () => {
    await render(<CartaoUltimoPonto ponto={ponto()} />);

    expect(screen.getByText('Av. Afonso Pena, 1000')).toBeTruthy();
  });
});
