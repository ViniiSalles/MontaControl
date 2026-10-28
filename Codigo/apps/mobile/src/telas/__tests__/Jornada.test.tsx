jest.mock('../../auth/AuthContext');
jest.mock('../../jornada/acoes');
jest.mock('../../sincronizacao/syncManager');
jest.mock('../../banco-horas/clienteBancoHoras');

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import {
  criarAcaoPendente,
  criarBancoDeTeste,
  gravarLinhasNaReplica,
  linhaDeJornada,
  linhaDePedido,
} from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { useAuth } from '../../auth/AuthContext';
import { registrarCheckin, registrarCheckout } from '../../jornada/acoes';
import { buscarBancoHoras } from '../../banco-horas/clienteBancoHoras';
import { iniciarSincronizacao, sincronizar } from '../../sincronizacao/syncManager';
import { ComSincronizacaoDoApp } from '../../db/__tests__/apoioReact';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { useUiStore } from '../../estado/uiStore';
import { instalarDiscoEmMemoria } from '../../estado/__tests__/apoio';
import { formatarHora } from '../../jornada/formatacao';
import { periodoAtual } from '../../banco-horas/periodo';
import { montador } from '../../auth/__tests__/apoio';
import { AGORA_FIXO_ISO, AGORA_FIXO_MS, fixarRelogio, soltarRelogio } from '../../jornada/__tests__/relogioFixo';
import { Jornada } from '../Jornada';

const abrirHistorico = jest.fn();
const abrirBancoHoras = jest.fn();
const lancarEmAtraso = jest.fn();

let database = criarBancoDeTeste();
let disco: ReturnType<typeof instalarDiscoEmMemoria>;

function renderizar() {
  return render(
    <DatabaseProvider database={database}>
      <ComSincronizacaoDoApp>
        <Jornada
          aoAbrirHistorico={abrirHistorico}
          aoAbrirBancoHoras={abrirBancoHoras}
          aoLancarEmAtraso={lancarEmAtraso}
          aoAbrirNotificacoes={jest.fn()}
        />
      </ComSincronizacaoDoApp>
    </DatabaseProvider>,
  );
}

const useAuthMock = jest.mocked(useAuth);
const registrarCheckinMock = jest.mocked(registrarCheckin);
const registrarCheckoutMock = jest.mocked(registrarCheckout);
const sincronizarMock = jest.mocked(sincronizar);
const buscarBancoHorasMock = jest.mocked(buscarBancoHoras);
const iniciarSincronizacaoMock = jest.mocked(iniciarSincronizacao);

/** A obra como o ponto a recebe da réplica (`pedidos`): id numérico + local do cliente. */
const OBRA = {
  id: 10,
  numeroPedido: 'PED-000010',
  cliente: {
    nome: 'Maria Souza',
    endereco: 'Av. Afonso Pena, 1000',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    latitude: -19.9325,
    longitude: -43.9382,
  },
};
const OUTRA_OBRA = {
  ...OBRA,
  id: 11,
  numeroPedido: 'PED-000011',
  cliente: { ...OBRA.cliente, nome: 'João Lima' },
};

/**
 * Check-in de duas horas antes do relógio fixo do teste, e não uma data
 * qualquer: jornada aberta só conta como "em andamento" dentro do limite de
 * 24h (`estadoJornada`) e a tela decide "hoje" pelo relógio.
 */
const CHECKIN_RECENTE = new Date(AGORA_FIXO_MS - 2 * 60 * 60 * 1000).toISOString();
const HORA_CHECKIN = formatarHora(CHECKIN_RECENTE);

/** Jornada aberta que o servidor mandou no pull (réplica). */
const abertaNaReplica = (parcial: Parameters<typeof linhaDeJornada>[0] = {}) =>
  linhaDeJornada({
    id: '1',
    status: StatusJornada.EM_ANDAMENTO,
    pedido_id: null,
    checkin_at: CHECKIN_RECENTE,
    checkin_endereco: 'Av. Afonso Pena, 1000',
    checkout_at: null,
    checkout_latitude: null,
    checkout_longitude: null,
    checkout_endereco: null,
    checkout_id_cliente: null,
    criado_em: CHECKIN_RECENTE,
    ...parcial,
  });

const CHECKOUT_RECENTE = new Date(AGORA_FIXO_MS - 30 * 60 * 1000).toISOString();
const HORA_CHECKOUT = formatarHora(CHECKOUT_RECENTE);

/** O que `executarAcaoJornada` devolve na tela; a jornada real vem da sobreposição, não daqui. */
const RESULTADO_DA_ACAO: JornadaDTO = {
  id: -1,
  usuarioId: -1,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: CHECKIN_RECENTE,
  checkinLatitude: -19.9325,
  checkinLongitude: -43.9382,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: CHECKIN_RECENTE,
};

/** Faz o papel da outbox: a marcação entra na fila (é ela que a tela sobrepõe) antes do `registrar*` voltar. */
function simularCheckinNaFila(registradoEm = CHECKIN_RECENTE, pedidoId = OBRA.id) {
  registrarCheckinMock.mockImplementation(async () => {
    await criarAcaoPendente(database, {
      tipo: 'checkin',
      idCliente: 'checkin-novo',
      payload: {
        idCliente: 'checkin-novo',
        latitude: -19.9325,
        longitude: -43.9382,
        registradoEm,
        pedidoId,
      },
      criadoEm: registradoEm,
    });
    return { tipo: 'ok', jornada: RESULTADO_DA_ACAO };
  });
}

function simularCheckoutNaFila() {
  registrarCheckoutMock.mockImplementation(async () => {
    await criarAcaoPendente(database, {
      tipo: 'checkout',
      idCliente: 'checkout-novo',
      payload: {
        idCliente: 'checkout-novo',
        latitude: -19.94,
        longitude: -43.94,
        registradoEm: CHECKOUT_RECENTE,
      },
      criadoEm: CHECKOUT_RECENTE,
    });
    return {
      tipo: 'ok',
      jornada: { ...RESULTADO_DA_ACAO, status: StatusJornada.FINALIZADA, checkoutAt: CHECKOUT_RECENTE },
    };
  });
}

const ROTULO_ENTRADA = 'Bater ponto de entrada';
const ROTULO_SAIDA = 'Bater ponto de saída';

const { mes: MES_ATUAL, ano: ANO_ATUAL } = periodoAtual(AGORA_FIXO_ISO);

afterEach(() => {
  soltarRelogio();
});

beforeEach(async () => {
  fixarRelogio();
  // `clearAllMocks` e não `resetAllMocks`: as implementações que o preset
  // jest-expo instala para os componentes nativos precisam sobreviver.
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  useSincronizacaoStore.getState().reiniciar();
  // A obra escolhida mora no store global persistido: cada teste começa sem ela.
  disco = instalarDiscoEmMemoria();
  // Réplica padrão de todo teste: o saldo do mês corrente e uma obra.
  await gravarLinhasNaReplica(database, 'banco_horas', [
    {
      id: '1',
      mes: MES_ATUAL,
      ano: ANO_ATUAL,
      horas_trabalhadas: 0,
      horas_previstas: 168,
      saldo: -168,
    },
  ]);
  await gravarLinhasNaReplica(database, 'pedidos', [linhaDePedido()]);
  useAuthMock.mockReturnValue({
    sessao: { usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  sincronizarMock.mockResolvedValue(undefined);
  // Mês que não está na réplica (ex.: o teste com relógio congelado): sem rede.
  buscarBancoHorasMock.mockRejectedValue(new Error('offline'));
  iniciarSincronizacaoMock.mockReturnValue(() => {});
});

test('sem jornada aberta, a tela oferece o ponto de entrada', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy());
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.queryByText(ROTULO_SAIDA)).toBeNull();
});

test('jornada aberta da réplica mostra o check-in como último ponto e pede a saída', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);

  await renderizar();

  await waitFor(() => expect(screen.getByText(HORA_CHECKIN)).toBeTruthy());
  expect(screen.getByText('Av. Afonso Pena, 1000')).toBeTruthy();
  expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy();
});

test('bater a entrada: o ponto aparece na hora (ação na fila) e a tela passa a pedir a saída', async () => {
  simularCheckinNaFila();

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(registrarCheckinMock).toHaveBeenCalledWith(database, OBRA);
  expect(screen.getByText(`Ponto de entrada registrado às ${HORA_CHECKIN}.`)).toBeTruthy();
  expect(screen.getByText(HORA_CHECKIN)).toBeTruthy();
  // Pede o pull que traz a jornada definitiva; a marcação não depende dele.
  expect(sincronizarMock).toHaveBeenCalled();
  expect(await database.get('jornadas').query().fetchCount()).toBe(0);
});

test('bater a saída mantém o check-out na tela em vez de voltar ao estado vazio', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
  simularCheckoutNaFila();

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  // O check-out na fila fecha a jornada da réplica na leitura: o ponto
  // recém-batido continua visível e o botão volta a oferecer a entrada.
  await waitFor(() => expect(screen.getByText(HORA_CHECKOUT)).toBeTruthy());
  expect(registrarCheckoutMock).toHaveBeenCalledWith(database, null);
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.queryByText('Nenhum ponto registrado')).toBeNull();
});

test('localização negada não registra ponto e instrui o montador', async () => {
  registrarCheckinMock.mockResolvedValue({ tipo: 'sem_localizacao', motivo: 'permissao_negada' });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(/ajustes do aparelho/i)).toBeTruthy());
  expect(registrarCheckinMock).toHaveBeenCalledWith(database, OBRA);
  // Falhou: o botão continua oferecendo a entrada.
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.getByText('Nenhum ponto registrado')).toBeTruthy();
});

test('recusa da API aparece como erro sem trocar o estado do botão', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
  registrarCheckoutMock.mockResolvedValue({ tipo: 'recusado', codigo: 'SEM_JORNADA_ABERTA' });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  await waitFor(() => expect(screen.getByText(/não há jornada aberta/i)).toBeTruthy());
  expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy();
});

// Regressão: a falha de leitura chegou a esconder o botão principal, e o
// montador ficava sem como registrar por causa de um GET que não voltou.
test('falha ao sincronizar sem nenhum dado local avisa mas mantém o botão de bater ponto', async () => {
  useSincronizacaoStore.setState({ ultimoErro: 'sem_rede' });

  await renderizar();

  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar sua jornada')).toBeTruthy(),
  );
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
  expect(screen.getByText('Histórico de pontos')).toBeTruthy();
});

test('app desatualizado (426) mostra o aviso para atualizar, sem esconder o ponto', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
  useSincronizacaoStore.setState({ ultimoErro: 'versao_incompativel' });

  await renderizar();

  await waitFor(() => expect(screen.getByText('Atualize o aplicativo')).toBeTruthy());
  expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy();
});

test('atualizar dispara uma sincronização e a jornada que o pull traz aparece', async () => {
  useSincronizacaoStore.setState({ ultimoErro: 'sem_rede' });

  await renderizar();
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar sua jornada')).toBeTruthy(),
  );

  // O ⟳ do cabeçalho abre o painel de status; a sincronização sai do "Sincronizar agora".
  await fireEvent.press(screen.getByLabelText(/^Sincronização:/));
  expect(sincronizarMock).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Sincronizar agora'));
  expect(sincronizarMock).toHaveBeenCalledTimes(1);

  // O pull que o gatilho dispara grava a réplica e limpa o erro.
  await act(async () => {
    await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
    useSincronizacaoStore.setState({ ultimoErro: null });
  });

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(screen.queryByText('Não foi possível carregar sua jornada')).toBeNull();
});

test('os atalhos de histórico e ponto em atraso chamam a navegação da aba', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText('Histórico de pontos'));
  expect(abrirHistorico).toHaveBeenCalled();

  await fireEvent.press(screen.getByText('Lançar ponto em atraso'));
  expect(lancarEmAtraso).toHaveBeenCalled();
});

// Bug reportado: "trabalhadas hoje" resetava sempre que o montador abria um
// turno novo no mesmo dia, em vez de somar com o(s) turno(s) já fechados.
test('abrir um turno novo no mesmo dia soma com o turno anterior, não reseta "trabalhadas hoje"', async () => {
  // Hora fixa e bem longe da virada do dia civil (12:00 local): com
  // `Date.now()` puro, rodar o teste perto da meia-noite em
  // America/Sao_Paulo jogava o "checkin 5h atrás" pro dia civil anterior,
  // e "hoje" aparecia sem nenhum turno — falso negativo, não bug de produto.
  // `advanceTimers: true` é obrigatório com `waitFor`: sem isso o polling do
  // Testing Library nunca avança e a suíte trava (CI do PR fica em loop).
  jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date('2026-01-15T15:00:00.000Z'));

  const cincoHorasAtras = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  await gravarLinhasNaReplica(database, 'jornadas', [
    linhaDeJornada({
      id: '101',
      checkin_at: cincoHorasAtras,
      checkout_at: tresHorasAtras, // turno de 2h
      criado_em: cincoHorasAtras,
    }),
  ]);
  simularCheckinNaFila(new Date().toISOString());

  await renderizar();
  // Turno 1 (2h) já fechado, nenhuma jornada aberta ainda hoje.
  await waitFor(() => expect(screen.getByText('2h 00min')).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(registrarCheckinMock).toHaveBeenCalledWith(database, OBRA);
  // Turno 2 acabou de abrir (poucos ms de duração): o total não pode cair
  // abaixo das 2h que o turno 1 já tinha — antes da correção, resetava a
  // "0h 00min" porque a tela só olhava para o turno aberto agora.
  expect(screen.getByText('2h 00min')).toBeTruthy();

  jest.useRealTimers();
});

test('o atalho de banco de horas chama a navegação da aba', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Ver banco de horas')).toBeTruthy());

  await fireEvent.press(screen.getByText('Ver banco de horas'));

  expect(abrirBancoHoras).toHaveBeenCalled();
});

test('o saldo do mês vem da réplica; a tela não sincroniza sozinha ao abrir', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText('Ver banco de horas')).toBeTruthy());

  expect(sincronizarMock).not.toHaveBeenCalled();
});

// #107: a sincronização automática vive em `useSincronizacaoDoApp` (app
// autenticado), não na tela — montar Jornada não deve ligá-la de novo.
test('a tela Jornada não liga a sincronização automática por conta própria', async () => {
  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  // Uma única chamada: a do `ComSincronizacaoDoApp` que envolve a tela neste teste.
  expect(iniciarSincronizacaoMock).toHaveBeenCalledTimes(1);
});

test('ação pendente na fila marca o último ponto como aguardando envio', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
  await criarAcaoPendente(database, {
    tipo: 'checkout',
    idCliente: 'id-1',
    payload: {
      idCliente: 'id-1',
      latitude: -19.94,
      longitude: -43.94,
      registradoEm: CHECKOUT_RECENTE,
    },
  });

  await renderizar();

  await waitFor(() => expect(screen.getByText('Aguardando envio ao servidor')).toBeTruthy());
});

test('bater a saída também pede uma sincronização (histórico e saldo do mês)', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);
  simularCheckoutNaFila();

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_SAIDA)).toBeTruthy());
  expect(sincronizarMock).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  await waitFor(() => expect(sincronizarMock).toHaveBeenCalled());
  expect(registrarCheckoutMock).toHaveBeenCalledWith(database, null);
});

test('ação descartada na fila aparece como aviso ao abrir a tela', async () => {
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = 'id-1';
      registro.payload = '{}';
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'descartada';
      registro.mensagemDescarte = 'Ação recusada: JORNADA_EM_ANDAMENTO.';
    }),
  );

  await renderizar();

  await waitFor(() =>
    expect(screen.getByText('Ação recusada: JORNADA_EM_ANDAMENTO.')).toBeTruthy(),
  );
});

test('com mais de uma obra, a entrada exige escolher a obra', async () => {
  await gravarLinhasNaReplica(database, 'pedidos', [
    linhaDePedido({
      id: '11',
      numero_pedido: 'PED-000011',
      cliente_nome: 'João Lima',
    }),
  ]);
  simularCheckinNaFila(CHECKIN_RECENTE, OUTRA_OBRA.id);

  await renderizar();
  await waitFor(() => expect(screen.getByText('Nenhuma obra escolhida')).toBeTruthy());

  // Sem obra, bater a entrada abre a escolha em vez de registrar.
  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));
  expect(screen.getByText('Escolha a obra')).toBeTruthy();
  expect(registrarCheckinMock).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText('João Lima · PED-000011'));
  // Escolher fecha a lista e a obra aparece compacta acima do botão.
  expect(screen.queryByText('Escolha a obra')).toBeNull();
  expect(screen.getByText('João Lima')).toBeTruthy();
  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(registrarCheckinMock).toHaveBeenCalledWith(database, OUTRA_OBRA));
});

test('a obra escolhida sobrevive a fechar e reabrir o app: o ponto de entrada já vai com ela', async () => {
  await gravarLinhasNaReplica(database, 'pedidos', [
    linhaDePedido({ id: '11', numero_pedido: 'PED-000011', cliente_nome: 'João Lima' }),
  ]);
  const { unmount } = await renderizar();
  await waitFor(() => expect(screen.getByText('Nenhuma obra escolhida')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText(/^Obra:/));
  await fireEvent.press(screen.getByText('João Lima · PED-000011'));
  await unmount();

  await act(async () => {
    await disco.fecharEReabrirOApp();
  });
  expect(useUiStore.getState().obraEscolhidaId).toBe(OUTRA_OBRA.id);
  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());
  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  expect(screen.queryByText('Escolha a obra')).toBeNull();
  await waitFor(() => expect(registrarCheckinMock).toHaveBeenCalledWith(database, OUTRA_OBRA));
});

test('obra escolhida que deixou de existir na réplica é ignorada: com uma obra só, vale a única', async () => {
  useUiStore.getState().escolherObra(9999);

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());
  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(registrarCheckinMock).toHaveBeenCalledWith(database, OBRA));
});

test('sem obra atribuída avisa e não registra', async () => {
  await database.write(async () => {
    for (const pedido of await database.get('pedidos').query().fetch()) {
      await pedido.destroyPermanently();
    }
  });

  await renderizar();

  await waitFor(() => expect(screen.getByText('Nenhuma obra atribuída')).toBeTruthy());
  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));
  expect(registrarCheckinMock).not.toHaveBeenCalled();
});

test('a saída usa a obra do check-in (jornadas.pedido_id da réplica), sem rede', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica({ pedido_id: '10' })]);
  simularCheckoutNaFila();

  await renderizar();
  // Com ponto aberto, a obra aparece no cartão só leitura (sem "Trocar").
  await waitFor(() => expect(screen.getByText('Maria Souza')).toBeTruthy());
  expect(screen.queryByText('Trocar')).toBeNull();

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  await waitFor(() => expect(registrarCheckoutMock).toHaveBeenCalledWith(database, OBRA));
});

test('a saída de um check-in feito offline usa a obra gravada na ação da fila', async () => {
  await criarAcaoPendente(database, {
    tipo: 'checkin',
    idCliente: 'checkin-offline',
    payload: {
      idCliente: 'checkin-offline',
      latitude: -19.9325,
      longitude: -43.9382,
      registradoEm: CHECKIN_RECENTE,
      pedidoId: 10,
    },
    criadoEm: CHECKIN_RECENTE,
  });
  simularCheckoutNaFila();

  await renderizar();
  // Com ponto aberto, a obra aparece no cartão só leitura (sem "Trocar").
  await waitFor(() => expect(screen.getByText('Maria Souza')).toBeTruthy());
  expect(screen.queryByText('Trocar')).toBeNull();

  await fireEvent.press(screen.getByText(ROTULO_SAIDA));

  await waitFor(() => expect(registrarCheckoutMock).toHaveBeenCalledWith(database, OBRA));
});

test('longe da obra o aviso mostra a distância', async () => {
  registrarCheckinMock.mockResolvedValue({ tipo: 'fora_do_raio', distanciaMetros: 1250 });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());

  await fireEvent.press(screen.getByText(ROTULO_ENTRADA));

  await waitFor(() => expect(screen.getByText(/cerca de 1,3 km/)).toBeTruthy());
  expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy();
});

test('com uma obra só, ela aparece compacta e não há o que trocar', async () => {
  await renderizar();

  await waitFor(() => expect(screen.getByText('Maria Souza')).toBeTruthy());
  expect(screen.queryByText('Trocar')).toBeNull();
  expect(screen.queryByText('Escolha a obra')).toBeNull();
});

test('sair fica no painel da conta, não solto na tela', async () => {
  const sair = jest.fn();
  useAuthMock.mockReturnValue({
    sessao: { usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair,
  });

  await renderizar();
  await waitFor(() => expect(screen.getByText(ROTULO_ENTRADA)).toBeTruthy());
  expect(screen.queryByText('Sair')).toBeNull();

  await fireEvent.press(screen.getByLabelText('Conta'));
  expect(screen.getByText(montador.nome)).toBeTruthy();
  await fireEvent.press(screen.getByText('Sair'));

  expect(sair).toHaveBeenCalled();
});

test('a jornada aberta não mostra mais o mapa, só o endereço do último ponto', async () => {
  await gravarLinhasNaReplica(database, 'jornadas', [abertaNaReplica()]);

  await renderizar();

  await waitFor(() => expect(screen.getByText('Av. Afonso Pena, 1000')).toBeTruthy());
  expect(screen.queryByTestId('mapa-webview')).toBeNull();
});
