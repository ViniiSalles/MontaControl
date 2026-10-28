jest.mock('expo-camera', () => {
  const { View } = jest.requireActual('react-native');
  return {
    CameraView: () => <View testID="camera-ativa" />,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

import { render, screen } from '@testing-library/react-native';
import { AbaVisivelContext } from '../../../navegacao/AbaVisivel';
import { LeitorCodigoBarras } from '../LeitorCodigoBarras';

test('com a aba visível, a câmera está ligada', async () => {
  await render(<LeitorCodigoBarras aoLer={jest.fn()} />);

  expect(screen.getByTestId('camera-ativa')).toBeTruthy();
});

test('com a aba oculta (notificações por cima), a câmera é desmontada e não lê código', async () => {
  await render(
    <AbaVisivelContext.Provider value={false}>
      <LeitorCodigoBarras aoLer={jest.fn()} />
    </AbaVisivelContext.Provider>,
  );

  expect(screen.queryByTestId('camera-ativa', { includeHiddenElements: true })).toBeNull();
});
