import { BackHandler } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useVoltarDoAndroid } from '../useVoltarDoAndroid';

type Ouvinte = Parameters<typeof BackHandler.addEventListener>[1];

function espionarBackHandler() {
  const ouvintes: Ouvinte[] = [];
  const remover = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_evento, ouvinte) => {
    ouvintes.push(ouvinte);
    return { remove: remover };
  });
  return { ouvintes, remover };
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('ativo, o voltar do aparelho chama aoVoltar e é consumido', async () => {
  const { ouvintes } = espionarBackHandler();
  const aoVoltar = jest.fn();

  await renderHook(() => useVoltarDoAndroid(true, aoVoltar));

  expect(ouvintes).toHaveLength(1);
  // O ouvinte do app não lê o evento; o sistema só quer saber se foi consumido.
  expect(ouvintes[0]({} as Parameters<Ouvinte>[0])).toBe(true);
  expect(aoVoltar).toHaveBeenCalledTimes(1);
});

test('inativo (na tela raiz), não intercepta: o sistema decide o que fazer', async () => {
  const { ouvintes } = espionarBackHandler();

  await renderHook(() => useVoltarDoAndroid(false, jest.fn()));

  expect(ouvintes).toHaveLength(0);
});

test('solta o ouvinte ao desmontar', async () => {
  const { remover } = espionarBackHandler();

  const { unmount } = await renderHook(() => useVoltarDoAndroid(true, jest.fn()));
  await unmount();

  expect(remover).toHaveBeenCalled();
});
