import { estiloTexto, sombraPorNivel, cores } from '@montacontrol/design-tokens/native';
import type { PropsTexto } from '@montacontrol/ui-contracts/texto';

test('apps/mobile resolve @montacontrol/design-tokens/native e ui-contracts', () => {
  expect(cores.primary).toBe('#004d99');
  expect(estiloTexto({ px: 16, lineHeight: 24, peso: 700, tracking: '0' }).fontFamily).toBe(
    'Inter_700Bold',
  );
  expect(sombraPorNivel('elev2', 'ios').shadowOpacity).toBe(0.04);
  const props: PropsTexto = { variante: 'bodyMd', children: 'ok' };
  expect(props.variante).toBe('bodyMd');
});
