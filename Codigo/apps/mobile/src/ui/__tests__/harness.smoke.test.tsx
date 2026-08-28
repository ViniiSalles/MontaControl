import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

test('harness de teste renderiza um componente RN', async () => {
  // `render` do @testing-library/react-native é assíncrono a partir da v13
  // (o brief original tinha uma chamada síncrona, incompatível com a
  // versão ^14 resolvida pelo `expo install` para este SDK/React 19 — ver
  // task-4-report.md). Sem o `await`, `screen` ainda não foi populado
  // quando a asserção roda, e o teste falha com
  // "`render` function has not been called".
  await render(<Text>ok</Text>);
  expect(screen.getByText('ok')).toBeTruthy();
});
