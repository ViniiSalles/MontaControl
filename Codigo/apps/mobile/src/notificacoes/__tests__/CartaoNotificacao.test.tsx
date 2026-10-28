import { render, screen } from '@testing-library/react-native';
import { CartaoNotificacao } from '../CartaoNotificacao';
import type { NotificacaoLocal } from '../useNotificacoes';

function notificacao(parcial: Partial<NotificacaoLocal> = {}): NotificacaoLocal {
  return {
    id: '1',
    tipo: 'AVARIA_ATUALIZADA',
    titulo: 'Avaria em análise',
    mensagem: 'Sua avaria está em análise.',
    referenciaTipo: null,
    referenciaId: null,
    lida: false,
    criadaEm: '2026-10-14T15:00:00.000Z',
    ...parcial,
  };
}

describe('CartaoNotificacao (acessibilidade)', () => {
  it('não lida: o rótulo diz "não lida", além do título e da mensagem', async () => {
    await render(<CartaoNotificacao notificacao={notificacao()} hora="12:00" aoPressionar={jest.fn()} />);

    expect(screen.getByLabelText('Não lida. Avaria em análise. Sua avaria está em análise.')).toBeTruthy();
  });

  it('lida: o rótulo não menciona "não lida"', async () => {
    await render(<CartaoNotificacao notificacao={notificacao({ lida: true })} hora="12:00" />);

    expect(screen.getByLabelText('Avaria em análise. Sua avaria está em análise.')).toBeTruthy();
  });

  it('desabilitado (sem conexão) é anunciado como desabilitado', async () => {
    await render(<CartaoNotificacao notificacao={notificacao()} hora="12:00" desabilitado />);

    expect(screen.getByLabelText(/^Não lida\./)).toBeDisabled();
  });

  it('habilitado, o cartão não lido não é anunciado como desabilitado', async () => {
    await render(<CartaoNotificacao notificacao={notificacao()} hora="12:00" aoPressionar={jest.fn()} />);

    expect(screen.getByLabelText(/^Não lida\./)).not.toBeDisabled();
  });
});
