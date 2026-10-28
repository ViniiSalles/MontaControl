jest.mock('../../notificacoes/clienteNotificacoes', () => ({
  marcarNotificacaoLida: jest.fn(),
  marcarTodasNotificacoesLidas: jest.fn(),
}));
jest.mock('../../sincronizacao/syncManager', () => ({ sincronizar: jest.fn() }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { criarBancoDeTeste, gravarLinhasNaReplica } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { fixarRelogio, soltarRelogio } from '../../jornada/__tests__/relogioFixo';
import { marcarNotificacaoLida, marcarTodasNotificacoesLidas } from '../../notificacoes/clienteNotificacoes';
import { linhaDeNotificacao } from '../../notificacoes/__tests__/apoioNotificacoes';
import { sincronizar } from '../../sincronizacao/syncManager';
import { Notificacoes } from '../Notificacoes';

const marcarLidaMock = jest.mocked(marcarNotificacaoLida);
const marcarTodasMock = jest.mocked(marcarTodasNotificacoesLidas);
const sincronizarMock = jest.mocked(sincronizar);

const voltar = jest.fn();
const abrirAba = jest.fn();

let database = criarBancoDeTeste();

/** "Agora" fixo: 2026-10-14 14:00 em São Paulo. Três não lidas (hoje, hoje, ontem) e uma lida antiga sem destino. */
async function semearTresNaoLidas() {
  await gravarLinhasNaReplica(database, 'notificacoes', [
    linhaDeNotificacao({
      id: '1',
      tipo: 'AVARIA_ATUALIZADA',
      titulo: 'Avaria em análise',
      mensagem: 'Sua avaria está em análise.',
      criada_em: '2026-10-14T15:00:00.000Z',
    }),
    linhaDeNotificacao({
      id: '2',
      tipo: 'ATESTADO_VALIDADO',
      titulo: 'Atestado validado',
      mensagem: 'Seu atestado foi validado.',
      criada_em: '2026-10-14T13:00:00.000Z',
    }),
    linhaDeNotificacao({
      id: '3',
      tipo: 'PONTO_ATRASO_REJEITADO',
      titulo: 'Ponto em atraso rejeitado',
      mensagem: 'Sua solicitação foi rejeitada.',
      criada_em: '2026-10-13T20:00:00.000Z',
    }),
    linhaDeNotificacao({
      id: '4',
      tipo: 'AVARIA_REPORTADA',
      titulo: 'Avaria reportada',
      mensagem: 'Já lida e sem destino.',
      lida: true,
      criada_em: '2026-10-10T12:00:00.000Z',
    }),
  ]);
}

async function renderizar() {
  await render(<Notificacoes aoVoltar={voltar} aoAbrirAba={abrirAba} />, { wrapper: comBanco(database) });
}

beforeEach(() => {
  jest.clearAllMocks();
  fixarRelogio();
  database = criarBancoDeTeste();
  useSincronizacaoStore.getState().reiniciar();
  marcarLidaMock.mockResolvedValue(undefined);
  marcarTodasMock.mockResolvedValue(undefined);
  sincronizarMock.mockResolvedValue(undefined);
});

afterEach(() => {
  soltarRelogio();
});

describe('Notificacoes', () => {
  it('tela mostra "Você tem 3 novas mensagens"', async () => {
    await semearTresNaoLidas();

    await renderizar();

    await waitFor(() => expect(screen.getByText('Você tem 3 novas mensagens')).toBeTruthy());
    expect(screen.getByText('Notificações')).toBeTruthy();
    // Agrupadas por dia civil no fuso de operação, com a hora de cada uma.
    expect(screen.getByText('HOJE')).toBeTruthy();
    expect(screen.getByText('ONTEM')).toBeTruthy();
    expect(screen.getByText('10/10/2026')).toBeTruthy();
    expect(screen.getByText('12:00')).toBeTruthy();
    expect(screen.getByText('Avaria em análise')).toBeTruthy();
    expect(screen.getByText('Seu atestado foi validado.')).toBeTruthy();
  });

  it('subtítulo no singular', async () => {
    await gravarLinhasNaReplica(database, 'notificacoes', [linhaDeNotificacao()]);

    await renderizar();

    await waitFor(() => expect(screen.getByText('Você tem 1 nova mensagem')).toBeTruthy());
  });

  it('sem notificações, mostra o estado vazio', async () => {
    await renderizar();

    expect(screen.getByText('Nenhuma mensagem nova')).toBeTruthy();
    expect(screen.getByText('Nenhuma notificação por aqui')).toBeTruthy();
    expect(screen.queryByText('HOJE')).toBeNull();
  });

  it('voltar chama aoVoltar', async () => {
    await renderizar();

    await fireEvent.press(screen.getByLabelText('Voltar'));

    expect(voltar).toHaveBeenCalledTimes(1);
  });

  describe('marcar todas como lidas', () => {
    it('online, chama a API e depois sincroniza para a réplica refletir', async () => {
      await semearTresNaoLidas();
      await renderizar();
      await waitFor(() => expect(screen.getByText('Você tem 3 novas mensagens')).toBeTruthy());

      await fireEvent.press(screen.getByText('Marcar todas como lidas'));

      await waitFor(() => expect(sincronizarMock).toHaveBeenCalledWith(database));
      expect(marcarTodasMock).toHaveBeenCalledTimes(1);
    });

    it('marcar todas desabilitado offline', async () => {
      await semearTresNaoLidas();
      useSincronizacaoStore.setState({ online: false });
      await renderizar();
      await waitFor(() => expect(screen.getByText('Você tem 3 novas mensagens')).toBeTruthy());

      await fireEvent.press(screen.getByText('Marcar todas como lidas'));

      expect(marcarTodasMock).not.toHaveBeenCalled();
      expect(sincronizarMock).not.toHaveBeenCalled();
    });

    it('desabilitado também quando não há nada não lido', async () => {
      await gravarLinhasNaReplica(database, 'notificacoes', [linhaDeNotificacao({ lida: true })]);
      await renderizar();

      await fireEvent.press(screen.getByText('Marcar todas como lidas'));

      expect(marcarTodasMock).not.toHaveBeenCalled();
    });

    it('se a API falha, avisa e não sincroniza', async () => {
      await semearTresNaoLidas();
      marcarTodasMock.mockRejectedValue(new TypeError('Network request failed'));
      await renderizar();
      await waitFor(() => expect(screen.getByText('Você tem 3 novas mensagens')).toBeTruthy());

      await fireEvent.press(screen.getByText('Marcar todas como lidas'));

      await waitFor(() => expect(screen.getByText(/Não foi possível marcar/)).toBeTruthy());
      expect(sincronizarMock).not.toHaveBeenCalled();
    });
  });

  describe('tocar no cartão', () => {
    it('não lida, online: marca como lida (id numérico) e sincroniza', async () => {
      await semearTresNaoLidas();
      await renderizar();
      await waitFor(() => expect(screen.getByText('Avaria em análise')).toBeTruthy());

      await fireEvent.press(screen.getByText('Avaria em análise'));

      await waitFor(() => expect(sincronizarMock).toHaveBeenCalledWith(database));
      expect(marcarLidaMock).toHaveBeenCalledWith(1);
    });

    it('já lida: não chama a API', async () => {
      await semearTresNaoLidas();
      await renderizar();
      await waitFor(() => expect(screen.getByText('Avaria reportada')).toBeTruthy());

      await fireEvent.press(screen.getByText('Avaria reportada'));

      expect(marcarLidaMock).not.toHaveBeenCalled();
    });

    it('offline: não chama a API', async () => {
      await semearTresNaoLidas();
      useSincronizacaoStore.setState({ online: false });
      await renderizar();
      await waitFor(() => expect(screen.getByText('Avaria em análise')).toBeTruthy());

      await fireEvent.press(screen.getByText('Avaria em análise'));

      expect(marcarLidaMock).not.toHaveBeenCalled();
    });

    it('falha da API mostra o aviso', async () => {
      await semearTresNaoLidas();
      marcarLidaMock.mockRejectedValue(new TypeError('Network request failed'));
      await renderizar();
      await waitFor(() => expect(screen.getByText('Avaria em análise')).toBeTruthy());

      await fireEvent.press(screen.getByText('Avaria em análise'));

      await waitFor(() => expect(screen.getByText(/Não foi possível marcar/)).toBeTruthy());
    });
  });

  describe('botão de ação', () => {
    it('botão de ação abre a aba correta', async () => {
      await semearTresNaoLidas();
      await renderizar();
      await waitFor(() => expect(screen.getAllByText('Ver detalhes')).toHaveLength(3));

      // Do mais novo para o mais antigo: avaria, atestado, ponto em atraso.
      const botoes = screen.getAllByText('Ver detalhes');
      await fireEvent.press(botoes[0]);
      await fireEvent.press(botoes[1]);
      await fireEvent.press(botoes[2]);

      expect(abrirAba.mock.calls).toEqual([['avarias'], ['atestados'], ['jornada']]);
    });

    it('funciona offline (é só navegação) e não tenta marcar como lida', async () => {
      await semearTresNaoLidas();
      useSincronizacaoStore.setState({ online: false });
      await renderizar();
      await waitFor(() => expect(screen.getAllByText('Ver detalhes')).toHaveLength(3));

      await fireEvent.press(screen.getAllByText('Ver detalhes')[0]);

      expect(abrirAba).toHaveBeenCalledWith('avarias');
      expect(marcarLidaMock).not.toHaveBeenCalled();
    });

    it('online, ao abrir a aba também marca a notificação não lida como lida', async () => {
      await semearTresNaoLidas();
      await renderizar();
      await waitFor(() => expect(screen.getAllByText('Ver detalhes')).toHaveLength(3));

      await fireEvent.press(screen.getAllByText('Ver detalhes')[1]);

      expect(abrirAba).toHaveBeenCalledWith('atestados');
      await waitFor(() => expect(marcarLidaMock).toHaveBeenCalledWith(2));
    });

    it('tipo sem destino não tem botão', async () => {
      await gravarLinhasNaReplica(database, 'notificacoes', [
        linhaDeNotificacao({ tipo: 'AVARIA_REPORTADA', titulo: 'Sem destino' }),
      ]);

      await renderizar();

      await waitFor(() => expect(screen.getByText('Sem destino')).toBeTruthy());
      expect(screen.queryByText('Ver detalhes')).toBeNull();
    });
  });
});
