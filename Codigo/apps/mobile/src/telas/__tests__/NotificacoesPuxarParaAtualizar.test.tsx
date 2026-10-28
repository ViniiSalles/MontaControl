// O `RefreshControl` não é alcançável pelo Testing Library; a tela entrega o
// gesto à `Tela` (`aoAtualizar`/`atualizando`), então é lá que se captura.
const mockPropsDaTela: { atual: { aoAtualizar?: () => void; atualizando?: boolean } } = { atual: {} };
jest.mock('../../ui/Tela', () => ({
  Tela: (props: { children: React.ReactNode; aoAtualizar?: () => void; atualizando?: boolean }) => {
    mockPropsDaTela.atual = props;
    return props.children;
  },
}));
jest.mock('../../sincronizacao/syncManager', () => ({ sincronizar: jest.fn() }));

import { act, render } from '@testing-library/react-native';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { sincronizar } from '../../sincronizacao/syncManager';
import { Notificacoes } from '../Notificacoes';

test('puxar para atualizar sincroniza e mostra o indicador enquanto espera', async () => {
  const database = criarBancoDeTeste();
  let concluir: () => void = () => undefined;
  jest.mocked(sincronizar).mockReturnValue(new Promise<void>((resolver) => (concluir = resolver)));
  await render(<Notificacoes aoVoltar={jest.fn()} aoAbrirAba={jest.fn()} />, { wrapper: comBanco(database) });
  expect(mockPropsDaTela.atual.atualizando).toBe(false);

  await act(async () => mockPropsDaTela.atual.aoAtualizar?.());

  expect(sincronizar).toHaveBeenCalledWith(database);
  expect(mockPropsDaTela.atual.atualizando).toBe(true);

  await act(async () => concluir());

  expect(mockPropsDaTela.atual.atualizando).toBe(false);
});
