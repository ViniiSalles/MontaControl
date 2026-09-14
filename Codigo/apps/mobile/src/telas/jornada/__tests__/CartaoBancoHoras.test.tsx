import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BancoHorasDTO } from '@montacontrol/shared';
import { CartaoBancoHoras } from '../CartaoBancoHoras';

function bancoHorasFake(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return {
    id: 1,
    usuarioId: 7,
    mes: 8,
    ano: 2026,
    horasTrabalhadas: 160,
    horasPrevistas: 168,
    saldo: -8,
    ...parcial,
  };
}

describe('CartaoBancoHoras', () => {
  it('sem dado (null), não renderiza nada', async () => {
    const resultado = await render(<CartaoBancoHoras bancoHoras={null} aoAbrirBancoHoras={jest.fn()} />);

    expect(resultado.toJSON()).toBeNull();
  });

  it('saldo positivo mostra o valor com sinal e o selo "Saldo positivo"', async () => {
    await render(
      <CartaoBancoHoras bancoHoras={bancoHorasFake({ saldo: 12.75 })} aoAbrirBancoHoras={jest.fn()} />,
    );

    expect(screen.getByText('+12h 45min')).toBeTruthy();
    expect(screen.getByText(/saldo positivo/i)).toBeTruthy();
  });

  it('saldo negativo mostra o selo "Saldo negativo"', async () => {
    await render(
      <CartaoBancoHoras bancoHoras={bancoHorasFake({ saldo: -8 })} aoAbrirBancoHoras={jest.fn()} />,
    );

    expect(screen.getByText('-8h 00min')).toBeTruthy();
    expect(screen.getByText(/saldo negativo/i)).toBeTruthy();
  });

  it('saldo zero mostra o selo "Em dia"', async () => {
    await render(
      <CartaoBancoHoras bancoHoras={bancoHorasFake({ saldo: 0 })} aoAbrirBancoHoras={jest.fn()} />,
    );

    expect(screen.getByText(/em dia/i)).toBeTruthy();
  });

  it('tocar "Ver histórico completo" chama o callback', async () => {
    const abrir = jest.fn();
    await render(<CartaoBancoHoras bancoHoras={bancoHorasFake()} aoAbrirBancoHoras={abrir} />);

    await fireEvent.press(screen.getByText('Ver histórico completo'));

    expect(abrir).toHaveBeenCalled();
  });
});
