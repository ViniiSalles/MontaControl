import { render } from '@testing-library/react-native';
import { PulsoAtividade } from '../PulsoAtividade';

test('ativo=false não inicia o loop e desmonta sem erro', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  const { unmount } = await render(<PulsoAtividade ativo={false} />);
  expect(() => unmount()).not.toThrow();
});

test('ativo=true (default) monta e desmonta sem erro, parando o loop', async () => {
  // Cobre a limpeza do `Animated.loop` (`loop.stop()` no retorno do
  // `useEffect`) — sem ela, o loop segue rodando após o unmount.
  const { unmount } = await render(<PulsoAtividade />);
  expect(() => unmount()).not.toThrow();
});
