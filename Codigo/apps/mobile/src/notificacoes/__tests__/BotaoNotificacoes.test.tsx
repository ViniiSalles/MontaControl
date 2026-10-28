import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { criarBancoDeTeste, gravarLinhasNaReplica } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { BotaoNotificacoes } from '../BotaoNotificacoes';
import { linhaDeNotificacao } from './apoioNotificacoes';

async function renderizar(database: ReturnType<typeof criarBancoDeTeste>, aoPressionar = jest.fn()) {
  await render(<BotaoNotificacoes aoPressionar={aoPressionar} />, { wrapper: comBanco(database) });
  return aoPressionar;
}

describe('BotaoNotificacoes', () => {
  it('BotaoNotificacoes mostra contador e abre a tela', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'notificacoes', [
      linhaDeNotificacao(),
      linhaDeNotificacao(),
      linhaDeNotificacao({ lida: true }),
    ]);

    const aoPressionar = await renderizar(database);

    await waitFor(() => expect(screen.getByLabelText('Notificações, 2 não lidas')).toBeTruthy());
    expect(screen.getByText('2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Notificações, 2 não lidas'));
    expect(aoPressionar).toHaveBeenCalledTimes(1);
  });

  it('com uma não lida, o rótulo acessível fica no singular', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'notificacoes', [linhaDeNotificacao()]);

    await renderizar(database);

    await waitFor(() => expect(screen.getByLabelText('Notificações, 1 não lida')).toBeTruthy());
  });

  it('sem não lidas, não mostra selo', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'notificacoes', [linhaDeNotificacao({ lida: true })]);

    await renderizar(database);

    expect(screen.getByLabelText('Notificações, 0 não lidas')).toBeTruthy();
    expect(screen.queryByTestId('selo-notificacoes')).toBeNull();
  });

  it('de 10 em diante o selo mostra 9+', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(
      database,
      'notificacoes',
      Array.from({ length: 12 }, () => linhaDeNotificacao()),
    );

    await renderizar(database);

    await waitFor(() => expect(screen.getByText('9+')).toBeTruthy());
    expect(screen.getByLabelText('Notificações, 12 não lidas')).toBeTruthy();
  });
});
