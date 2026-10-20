import { fireEvent, render, screen } from '@testing-library/react-native';
import { BloqueioSemObra } from '../BloqueioSemObra';

describe('BloqueioSemObra', () => {
  it('explica o motivo e leva à Jornada', async () => {
    const aoIrParaJornada = jest.fn();
    await render(
      <BloqueioSemObra titulo="Bata o ponto de entrada para conferir peças" motivo="sem_ponto" aoIrParaJornada={aoIrParaJornada} />,
    );

    expect(screen.getByText('Bata o ponto de entrada para conferir peças')).toBeTruthy();
    expect(screen.getByText(/escolha a obra e bata a entrada/i)).toBeTruthy();
    await fireEvent.press(screen.getByText('Ir para a Jornada'));
    expect(aoIrParaJornada).toHaveBeenCalled();
  });

  it('jornada vencida aponta o ponto em atraso', async () => {
    await render(<BloqueioSemObra titulo="t" motivo="jornada_vencida" aoIrParaJornada={jest.fn()} />);

    expect(screen.getByText(/passou de 24h sem saída/i)).toBeTruthy();
  });
});
