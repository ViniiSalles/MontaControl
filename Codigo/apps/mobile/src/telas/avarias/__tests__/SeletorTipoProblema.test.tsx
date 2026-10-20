import { fireEvent, render, screen } from '@testing-library/react-native';
import { SeletorTipoProblema } from '../SeletorTipoProblema';

const TIPOS = [
  { id: 9, nome: 'Outro', descricao: 'Problema não listado — detalhado na descrição' },
  { id: 1, nome: 'Amassado', descricao: 'Deformação superficial por impacto' },
];

describe('SeletorTipoProblema', () => {
  it('sem escolha, mostra o vazio e abre a lista com "Outro" por último', async () => {
    await render(
      <SeletorTipoProblema tipos={TIPOS} selecionadoId={null} aoSelecionar={jest.fn()} />,
    );

    expect(screen.getByText('Nenhum problema escolhido')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Problema: Nenhum problema escolhido. Escolher'));

    expect(screen.getByText('Tipo de problema')).toBeTruthy();
    const nomes = screen.getAllByRole('radio').map((opcao) => opcao.props.accessibilityLabel);
    expect(nomes).toEqual([
      'Amassado, Deformação superficial por impacto',
      'Outro, Problema não listado — detalhado na descrição',
    ]);
  });

  it('escolher avisa o id e fecha a lista', async () => {
    const aoSelecionar = jest.fn();
    await render(
      <SeletorTipoProblema tipos={TIPOS} selecionadoId={null} aoSelecionar={aoSelecionar} />,
    );
    await fireEvent.press(screen.getByLabelText(/^Problema:/));

    await fireEvent.press(screen.getByText('Amassado'));

    expect(aoSelecionar).toHaveBeenCalledWith(1);
    expect(screen.queryByText('Tipo de problema')).toBeNull();
  });

  it('com escolha, mostra o nome e oferece trocar; mostra o erro de validação', async () => {
    await render(
      <SeletorTipoProblema
        tipos={TIPOS}
        selecionadoId={1}
        aoSelecionar={jest.fn()}
        erro="Selecione o tipo de problema."
      />,
    );

    expect(screen.getByLabelText('Problema: Amassado. Trocar')).toBeTruthy();
    expect(screen.getByText('Selecione o tipo de problema.')).toBeTruthy();
  });
});
