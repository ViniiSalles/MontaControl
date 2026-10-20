jest.mock('../../auth/AuthContext');
jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../banco-horas/clienteBancoHoras');
jest.mock('../../avarias/clienteAvarias');
jest.mock('../../atestados/clienteAtestados');

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { useAuth } from '../../auth/AuthContext';
import { montador, respostaJson } from '../../auth/__tests__/apoio';
import { definirTokens } from '../../auth/tokenSessao';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { buscarBancoHoras } from '../../banco-horas/clienteBancoHoras';
import { periodoAtual } from '../../banco-horas/periodo';
import { AcaoPendente } from '../../db/AcaoPendente';
import { criarBancoDeTeste, pullSemMudancas } from '../../db/__tests__/apoio';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { instalarGatilhosFalsos } from '../../sincronizacao/__tests__/gatilhosFalsos';
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
