import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ObraDoPonto } from '../../../pedidos/obras';
import { CartaoObra } from '../CartaoObra';

const OBRA: ObraDoPonto = {
  id: 12,
  numeroPedido: 'PED-000012',
  cliente: {
    nome: 'Maria Souza',
    endereco: 'Av. Afonso Pena, 1000',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    latitude: 0,
    longitude: 0,
  },
};

describe('CartaoObra', () => {
  it('só leitura: mostra cliente e pedido, sem ação nem dica', async () => {
    await render(<CartaoObra obra={OBRA} />);

    expect(screen.getByText('Maria Souza')).toBeTruthy();
    expect(screen.getByText('PED-000012 · Av. Afonso Pena, 1000 · Belo Horizonte/MG')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Trocar')).toBeNull();
    expect(screen.queryByText(/encerre o ponto/i)).toBeNull();
  });

  it('com ação: o cartão inteiro é o botão, com o rótulo da ação', async () => {
    const aoPressionar = jest.fn();
    await render(<CartaoObra obra={OBRA} acao={{ rotulo: 'Trocar', aoPressionar }} />);

    await fireEvent.press(screen.getByLabelText('Obra: Maria Souza. Trocar'));

    expect(aoPressionar).toHaveBeenCalled();
  });

  it('sem obra: mostra o título e o detalhe do vazio', async () => {
    await render(
      <CartaoObra obra={null} tituloVazio="Nenhuma obra escolhida" detalheVazio="Escolha antes de bater o ponto." />,
    );

    expect(screen.getByText('Nenhuma obra escolhida')).toBeTruthy();
    expect(screen.getByText('Escolha antes de bater o ponto.')).toBeTruthy();
  });
});
