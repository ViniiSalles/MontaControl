import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { cores } from '@montacontrol/design-tokens/native';
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

const fundo = () => StyleSheet.flatten(screen.getByTestId('cartao').props.style).backgroundColor;

// O destaque escuro do Stitch é azul-ardósia; `inverso` (inverseSurface) lia
// como preto/cinza no aparelho.
test('tom destaque usa o secondary (azul-ardósia)', async () => {
  await render(<Cartao elevacao="none" tom="destaque" conteudo={<Texto variante="bodyMd">corpo</Texto>} />);
  expect(fundo()).toBe(cores.secondary);
});

test('tom inverso continua no inverseSurface', async () => {
  await render(<Cartao elevacao="none" tom="inverso" conteudo={<Texto variante="bodyMd">corpo</Texto>} />);
  expect(fundo()).toBe(cores.inverseSurface);
});
