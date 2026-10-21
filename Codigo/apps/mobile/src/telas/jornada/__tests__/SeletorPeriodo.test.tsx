import { fireEvent, render, screen } from '@testing-library/react-native';
import { SeletorPeriodo } from '../SeletorPeriodo';

describe('SeletorPeriodo', () => {
  it('oferece os três períodos da spec', async () => {
    await render(<SeletorPeriodo periodo={15} aoTrocar={jest.fn()} />);

    expect(screen.getByText('5 dias')).toBeTruthy();
    expect(screen.getByText('15 dias')).toBeTruthy();
    expect(screen.getByText('30 dias')).toBeTruthy();
  });

  it('avisa a troca de período', async () => {
    const aoTrocar = jest.fn();
    await render(<SeletorPeriodo periodo={15} aoTrocar={aoTrocar} />);

    await fireEvent.press(screen.getByText('30 dias'));

    expect(aoTrocar).toHaveBeenCalledWith(30);
  });
});

describe('SeletorPeriodo — controle segmentado', () => {
  it('anuncia só o período ativo como selecionado', async () => {
    await render(<SeletorPeriodo periodo={15} aoTrocar={jest.fn()} />);

    expect(screen.getByRole('radio', { name: '15 dias', selected: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '5 dias', selected: false })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '30 dias', selected: false })).toBeTruthy();
  });
});
