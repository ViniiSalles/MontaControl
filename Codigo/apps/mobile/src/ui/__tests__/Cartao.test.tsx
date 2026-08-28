import { render, screen } from '@testing-library/react-native';
import { Cartao } from '../Cartao';
import { Texto } from '../Texto';

test('renderiza conteúdo e rodapé', async () => {
  // `render` é async no @testing-library/react-native v14 (ver Task 4).
  await render(
    <Cartao
      elevacao="elev2"
      tom="padrao"
      conteudo={<Texto variante="bodyMd">corpo</Texto>}
      rodape={<Texto variante="bodySm">rodapé</Texto>}
    />,
  );
  expect(screen.getByText('corpo')).toBeTruthy();
  expect(screen.getByText('rodapé')).toBeTruthy();
});

test('sem rodapé, renderiza só o conteúdo', async () => {
  await render(<Cartao elevacao="none" tom="baixo" conteudo={<Texto variante="bodyMd">corpo</Texto>} />);
  expect(screen.getByText('corpo')).toBeTruthy();
  expect(screen.queryByText('rodapé')).toBeNull();
});
