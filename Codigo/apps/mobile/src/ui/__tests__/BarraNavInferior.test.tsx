import { render, screen, fireEvent } from '@testing-library/react-native';
import { BarraNavInferior } from '../BarraNavInferior';

test('renderiza os rótulos de todos os itens', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await render(
    <BarraNavInferior
      itens={[
        { rotulo: 'Jornada', icone: 'event_note', ativo: true },
        { rotulo: 'Bipagem', icone: 'barcode_scanner', ativo: false, desabilitado: true },
      ]}
    />,
  );
  expect(screen.getByText('Jornada')).toBeTruthy();
  expect(screen.getByText('Bipagem')).toBeTruthy();
});

test('item desabilitado não dispara aoPressionar', async () => {
  const aoPressionar = jest.fn();
  await render(
    <BarraNavInferior
      itens={[
        { rotulo: 'Jornada', icone: 'event_note', ativo: true },
        {
          rotulo: 'Bipagem',
          icone: 'barcode_scanner',
          ativo: false,
          desabilitado: true,
          aoPressionar,
        },
      ]}
    />,
  );
  fireEvent.press(screen.getByText('Bipagem'));
  expect(aoPressionar).not.toHaveBeenCalled();
});

test('item ativo dispara aoPressionar ao ser pressionado', async () => {
  const aoPressionar = jest.fn();
  await render(
    <BarraNavInferior
      itens={[
        { rotulo: 'Jornada', icone: 'event_note', ativo: true, aoPressionar },
        { rotulo: 'Bipagem', icone: 'barcode_scanner', ativo: false, desabilitado: true },
      ]}
    />,
  );
  fireEvent.press(screen.getByText('Jornada'));
  expect(aoPressionar).toHaveBeenCalledTimes(1);
});
