import { render } from '@testing-library/react-native';
import { Icone } from '../Icone';

test('preenchido troca de variante de arquivo', async () => {
  // `render` é async no @testing-library/react-native v14 (resolvido pelo
  // Task 4) — ver nota no teste de `<Texto>` acima. `UNSAFE_root` (usado no
  // snippet original do plano) foi removido nessa mesma versão — ver
  // `docs/guides/migration-v14.md` do pacote instalado — substituído aqui
  // por `toJSON()`, que expõe a árvore nativa renderizada.
  const semPreenchimento = await render(<Icone nome="check_circle" tamanho={32} />);
  const preenchido = await render(<Icone nome="check_circle" tamanho={32} preenchido />);
  const arvoreSemPreenchimento = JSON.stringify(semPreenchimento.toJSON());
  const arvorePreenchido = JSON.stringify(preenchido.toJSON());
  // XMLs diferentes — não é o mesmo arquivo.
  expect(arvoreSemPreenchimento).not.toBe(arvorePreenchido);
  // tamanho=32 chega ao SVG raiz em ambas as variantes.
  expect(arvoreSemPreenchimento).toContain('32');
  expect(arvorePreenchido).toContain('32');
});
