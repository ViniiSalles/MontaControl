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

  it('pedido sem obra vinculada avisa que o ponto não tem obra', async () => {
    await render(<BloqueioSemObra titulo="t" motivo="sem_obra_vinculada" aoIrParaJornada={jest.fn()} />);

    expect(screen.getByText(/não tem obra vinculada/i)).toBeTruthy();
  });

  it('obra fora da réplica avisa que ela ainda não está no aparelho', async () => {
    await render(<BloqueioSemObra titulo="t" motivo="obra_fora_da_replica" aoIrParaJornada={jest.fn()} />);

    expect(screen.getByText(/ainda não está no aparelho/i)).toBeTruthy();
  });
});
