jest.mock('../../auth/AuthContext');
jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../banco-horas/clienteBancoHoras');
jest.mock('../../avarias/clienteAvarias');
jest.mock('../../atestados/clienteAtestados');
jest.mock('../../notificacoes/clienteNotificacoes');
// O canal de tempo real é coberto em iniciarSocket.test.ts; aqui não abre socket de verdade.
jest.mock('../../sincronizacao/useSocketDoApp');

import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { useAuth } from '../../auth/AuthContext';
import { montador, respostaJson } from '../../auth/__tests__/apoio';
import { definirTokens } from '../../auth/tokenSessao';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { buscarBancoHoras } from '../../banco-horas/clienteBancoHoras';
import { periodoAtual } from '../../banco-horas/periodo';
import { AcaoPendente } from '../../db/AcaoPendente';
import { criarBancoDeTeste, gravarLinhasNaReplica, pullSemMudancas } from '../../db/__tests__/apoio';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { marcarNotificacaoLida } from '../../notificacoes/clienteNotificacoes';
import { linhaDeNotificacao } from '../../notificacoes/__tests__/apoioNotificacoes';
import { instalarGatilhosFalsos } from '../../sincronizacao/__tests__/gatilhosFalsos';
import { useSocketDoApp } from '../../sincronizacao/useSocketDoApp';
import { AppAutenticado } from '../AppAutenticado';

const { mes: MES, ano: ANO } = periodoAtual(new Date().toISOString());

let database = criarBancoDeTeste();
let gatilhos: ReturnType<typeof instalarGatilhosFalsos>;

function arvore() {
  return (
    <DatabaseProvider database={database}>
      <AppAutenticado />
    </DatabaseProvider>
  );
}

/** O rótulo da aba repete o título da tela ativa; a barra inferior é o último da árvore. */
async function irParaAba(rotulo: string) {
  const ocorrencias = screen.getAllByText(rotulo);
  await fireEvent.press(ocorrencias[ocorrencias.length - 1]);
}

async function enfileirarAvaria() {
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'avaria';
      registro.idCliente = 'avaria-1';
      registro.payload = JSON.stringify({ idCliente: 'avaria-1' });
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'pendente';
    }),
  );
}

async function contarAcoesNaFila() {
  return database.get<AcaoPendente>('acoes_pendentes').query().fetchCount();
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  gatilhos = instalarGatilhosFalsos();
  useSincronizacaoStore.getState().reiniciar();

  jest.mocked(useAuth).mockReturnValue({
    sessao: { usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  // O pull do `synchronize()` é o único download: sessão em memória + `fetch` falso.
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  globalThis.fetch = jest.fn().mockResolvedValue(respostaJson(200, pullSemMudancas(Date.now())));
  jest.mocked(buscarBancoHoras).mockResolvedValue({
    id: 1,
    usuarioId: montador.id,
    mes: MES,
    ano: ANO,
    horasTrabalhadas: 0,
    horasPrevistas: 168,
    saldo: -168,
  });
});

describe.each([
  ['a volta da conexão', () => gatilhos.emitirRede(true)],
  ['o retorno ao primeiro plano', () => gatilhos.emitirAppState('active')],
])('com a aba Avarias ativa, %s', (_nome, disparar) => {
  test('drena a fila', async () => {
    await enfileirarAvaria();
    // Sem rede no boot: a ação fica pendente. Só o gatilho posterior a envia.
    jest.mocked(enviarAvaria).mockRejectedValueOnce(new TypeError('Network request failed'));
    jest.mocked(enviarAvaria).mockResolvedValue({} as never);

    await render(arvore());
    await waitFor(() => expect(enviarAvaria).toHaveBeenCalledTimes(1));
    await irParaAba('Avarias');
    await waitFor(() => expect(screen.getByText('MEUS REPORTES')).toBeTruthy());
    expect(await contarAcoesNaFila()).toBe(1);

    // A sincronização do boot pode ainda estar terminando; disparar de novo é
    // inofensivo (uma sincronização por vez) e evita depender do instante exato.
    await waitFor(async () => {
      disparar();
      expect(await contarAcoesNaFila()).toBe(0);
    });
    expect(enviarAvaria).toHaveBeenCalledTimes(2);
  });
});

test('trocar de aba não cria nem derruba listeners de rede e AppState', async () => {
  await render(arvore());

  expect(gatilhos.adicionarRede).toHaveBeenCalledTimes(1);
  expect(gatilhos.adicionarAppState).toHaveBeenCalledTimes(1);
  expect(gatilhos.rede.size).toBe(1);
  expect(gatilhos.appState.size).toBe(1);

  for (const aba of ['Avarias', 'Atestados', 'Jornada', 'Avarias']) {
    await irParaAba(aba);
    expect(gatilhos.rede.size).toBe(1);
    expect(gatilhos.appState.size).toBe(1);
  }

  expect(gatilhos.adicionarRede).toHaveBeenCalledTimes(1);
  expect(gatilhos.adicionarAppState).toHaveBeenCalledTimes(1);
});

test('desmontar o app autenticado remove os listeners', async () => {
  const { unmount } = await render(arvore());
  expect(gatilhos.rede.size).toBe(1);
  expect(gatilhos.appState.size).toBe(1);

  await unmount();

  expect(gatilhos.rede.size).toBe(0);
  expect(gatilhos.appState.size).toBe(0);
});

const ABAS_COM_TELA = ['Jornada', 'Avarias', 'Atestados', 'Jornada'];

describe('indicador de status da sincronização', () => {
  test('em dia, o status fica no ⟳ de TODAS as abas; sem conexão, a faixa aparece em todas', async () => {
    await render(arvore());

    // Espera a sincronização do boot terminar: o botão deixa de dizer Sincronizando….
    await waitFor(() => expect(screen.getByLabelText(/^Sincronização: Sincronizado/)).toBeTruthy());
    for (const aba of ABAS_COM_TELA) {
      await irParaAba(aba);
      expect(screen.getByLabelText(/^Sincronização: Sincronizado/)).toBeTruthy();
      expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
    }

    await act(async () => gatilhos.emitirRede(false));
    for (const aba of ABAS_COM_TELA) {
      await irParaAba(aba);
      expect(screen.getByText('Sem conexão')).toBeTruthy();
    }

    await act(async () => gatilhos.emitirRede(true));
    await waitFor(() => expect(screen.getByLabelText(/^Sincronização: Sincronizado/)).toBeTruthy());
    for (const aba of ABAS_COM_TELA) {
      await irParaAba(aba);
      expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
    }
  });

  test('mostra o tamanho da fila em qualquer aba, e ele some quando a fila esvazia', async () => {
    await enfileirarAvaria();
    // Sem rede para enviar: a ação segue pendente.
    jest.mocked(enviarAvaria).mockRejectedValue(new TypeError('Network request failed'));

    await render(arvore());

    // Com rede, a fila não ocupa faixa: o ⟳ de cada aba ganha o ponto de atenção.
    for (const aba of ABAS_COM_TELA) {
      await irParaAba(aba);
      await waitFor(() => expect(screen.getByLabelText('Sincronização: 1 pendente')).toBeTruthy());
      expect(screen.getByTestId('ponto-status-sincronizacao')).toBeTruthy();
      expect(screen.queryByTestId('indicador-sincronizacao')).toBeNull();
    }

    await act(async () => gatilhos.emitirRede(false));
    await waitFor(() => expect(screen.getByText('Sem conexão · 1 pendente')).toBeTruthy());

    await act(async () => {
      await database.write(async () => {
        const [acao] = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
        await acao.destroyPermanently();
      });
    });
    await waitFor(() => expect(screen.getByText('Sem conexão')).toBeTruthy());
  });

  test('desmontar o app autenticado (logout) zera o status', async () => {
    const { unmount } = await render(arvore());
    await waitFor(() => expect(screen.getByLabelText(/^Sincronização: Sincronizado/)).toBeTruthy());
    expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).not.toBeNull();

    await unmount();

    expect(useSincronizacaoStore.getState()).toMatchObject({
      ultimaSincronizacaoEm: null,
      pendentes: 0,
      online: true,
    });
  });
});

test('sem ponto aberto, "Ir para a Jornada" na Bipagem troca para a aba Jornada', async () => {
  await render(arvore());
  await irParaAba('Bipagem');
  await waitFor(() => expect(screen.getByText('Ir para a Jornada')).toBeTruthy());

  await fireEvent.press(screen.getByText('Ir para a Jornada'));

  await waitFor(() => expect(screen.getByText('Jornada de Trabalho')).toBeTruthy());
});

test('liga o canal de tempo real junto com a sincronização do app autenticado', async () => {
  await render(arvore());

  expect(useSocketDoApp).toHaveBeenCalled();
});

describe('notificações', () => {
  const ROTULO_DO_SINO = /^Notificações, \d+ não lidas?$/;

  /** Captura os ouvintes do voltar do Android; o último registrado é o que o sistema chamaria primeiro. */
  function espionarVoltarDoAndroid() {
    type Ouvinte = Parameters<typeof BackHandler.addEventListener>[1];
    const ouvintes: Ouvinte[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_evento, ouvinte) => {
      ouvintes.push(ouvinte);
      return { remove: () => ouvintes.splice(ouvintes.indexOf(ouvinte), 1) };
    });
    return () => ouvintes[ouvintes.length - 1]({} as Parameters<Ouvinte>[0]);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('o sino aparece no cabeçalho das quatro abas', async () => {
    await render(arvore());

    for (const aba of ['Jornada', 'Bipagem', 'Avarias', 'Atestados']) {
      await irParaAba(aba);
      expect(screen.getByLabelText(ROTULO_DO_SINO)).toBeTruthy();
    }
  });

  test('o sino abre a tela de notificações e o voltar do Android fecha, de volta à aba de origem', async () => {
    const voltarDoAndroid = espionarVoltarDoAndroid();
    await render(arvore());
    await irParaAba('Avarias');
    await waitFor(() => expect(screen.getByText('MEUS REPORTES')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText(ROTULO_DO_SINO));

    await waitFor(() => expect(screen.getByText('Nenhuma mensagem nova')).toBeTruthy());
    expect(screen.queryByText('MEUS REPORTES')).toBeNull();
    // A barra inferior segue visível.
    expect(screen.getAllByText('Atestados').length).toBeGreaterThan(0);

    await act(async () => {
      expect(voltarDoAndroid()).toBe(true);
    });

    await waitFor(() => expect(screen.getByText('MEUS REPORTES')).toBeTruthy());
    expect(screen.queryByText('Nenhuma mensagem nova')).toBeNull();
  });

  test('o botão de voltar da tela fecha e mantém a aba ativa', async () => {
    await render(arvore());
    await irParaAba('Atestados');
    await fireEvent.press(screen.getByLabelText(ROTULO_DO_SINO));
    await waitFor(() => expect(screen.getByText('Nenhuma mensagem nova')).toBeTruthy());

    await fireEvent.press(screen.getByLabelText('Voltar'));

    await waitFor(() => expect(screen.getByText('HISTÓRICO RECENTE')).toBeTruthy());
  });

  test('tocar em uma aba da barra com a tela aberta fecha a tela e troca de aba', async () => {
    await render(arvore());
    await fireEvent.press(screen.getByLabelText(ROTULO_DO_SINO));
    await waitFor(() => expect(screen.getByText('Nenhuma mensagem nova')).toBeTruthy());

    await irParaAba('Avarias');

    await waitFor(() => expect(screen.getByText('MEUS REPORTES')).toBeTruthy());
    expect(screen.queryByText('Nenhuma mensagem nova')).toBeNull();
  });

  test('"Ver detalhes" de uma avaria fecha a tela e abre a aba Avarias', async () => {
    jest.mocked(marcarNotificacaoLida).mockResolvedValue(undefined);
    await gravarLinhasNaReplica(database, 'notificacoes', [
      linhaDeNotificacao({ tipo: 'AVARIA_ATUALIZADA', titulo: 'Avaria em análise' }),
    ]);
    await render(arvore());
    await fireEvent.press(screen.getByLabelText(ROTULO_DO_SINO));
    await waitFor(() => expect(screen.getByText('Avaria em análise')).toBeTruthy());

    await fireEvent.press(screen.getByText('Ver detalhes'));

    await waitFor(() => expect(screen.getByText('MEUS REPORTES')).toBeTruthy());
    expect(screen.queryByText('Avaria em análise')).toBeNull();
  });
});
