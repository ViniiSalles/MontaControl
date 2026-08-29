import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Modal } from '../Modal';

test('visivel=false não mostra o conteúdo', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await render(
    <Modal visivel={false} apresentacao="centro" titulo="Teste" conteudo={<Text>corpo</Text>} aoFechar={() => {}} />,
  );
  expect(screen.queryByText('corpo')).toBeNull();
});

test('botão de fechar chama aoFechar', async () => {
  const aoFechar = jest.fn();
  await render(
    <Modal visivel apresentacao="centro" titulo="Teste" conteudo={<Text>corpo</Text>} aoFechar={aoFechar} />,
  );
  // Seletor por `accessibilityLabel="Fechar"` do Pressable em Modal.tsx —
  // não depender de estrutura de DOM (`.parent.parent`), frágil a qualquer
  // ajuste de layout.
  fireEvent.press(screen.getByLabelText('Fechar'));
  expect(aoFechar).toHaveBeenCalledTimes(1);
});

test('tocar no overlay chama aoFechar', async () => {
  const aoFechar = jest.fn();
  await render(
    <Modal visivel apresentacao="centro" titulo="Teste" conteudo={<Text>corpo</Text>} aoFechar={aoFechar} />,
  );
  fireEvent.press(screen.getByTestId('modal-overlay'));
  expect(aoFechar).toHaveBeenCalledTimes(1);
});

test('cada ação em `acoes` dispara seu próprio aoPressionar', async () => {
  const aoConfirmar = jest.fn();
  const aoCancelar = jest.fn();
  await render(
    <Modal
      visivel
      apresentacao="centro"
      titulo="Teste"
      conteudo={<Text>corpo</Text>}
      acoes={[
        { texto: 'Cancelar', variante: 'fantasma', aoPressionar: aoCancelar },
        { texto: 'Confirmar', aoPressionar: aoConfirmar },
      ]}
      aoFechar={() => {}}
    />,
  );
  fireEvent.press(screen.getByText('Cancelar'));
  expect(aoCancelar).toHaveBeenCalledTimes(1);
  expect(aoConfirmar).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText('Confirmar'));
  expect(aoConfirmar).toHaveBeenCalledTimes(1);
});
