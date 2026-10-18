jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('../../auth/armazenamentoSessao', () => ({
  salvarSessao: jest.fn().mockResolvedValue(undefined),
}));

import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Q } from '@nozbe/watermelondb';
import { StatusAtestado, StatusAvaria, syncPullFixture } from '@montacontrol/shared';
import type { SyncPullResponse } from '@montacontrol/shared';
import { definirTokens } from '../../auth/tokenSessao';
import { respostaJson } from '../../auth/__tests__/apoio';
import { criarBancoDeTeste, gravarPullNaReplica } from '../../db/__tests__/apoio';
import { comBanco } from '../../db/__tests__/apoioReact';
import { AcaoPendente } from '../../db/AcaoPendente';
import { apagarTodasAsFotos } from '../../fotos/armazenamentoFotos';
import { base64DeTexto, criarFotoDoPicker, fotosGuardadas } from '../../fotos/__tests__/apoio';
import { ProvedorSincronizacao } from '../../sincronizacao/SincronizacaoContext';
import { instalarGatilhosFalsos } from '../../sincronizacao/__tests__/gatilhosFalsos';
import { reiniciarStatusDaSincronizacao } from '../../sincronizacao/statusDaSincronizacao';
import { Atestados } from '../Atestados';
import { Avarias } from '../Avarias';

// Acceptance da #113. Tudo real — réplica, fila, fotos em arquivo, sincronização,
// hooks e telas; só a rede é falsa: um servidor mínimo atrás do `fetch`, que
// guarda o que recebe e devolve no pull, e que o teste liga e desliga.

const SEM_REDE = new TypeError('Network request failed');

interface Servidor {
  online: boolean;
  avarias: { corpo: Record<string, unknown> }[];
  atestados: { corpo: Record<string, unknown> }[];
  /** Quando preenchido, o POST é recusado com 422 e esta mensagem. */
  recusa: { codigo: string; message: string } | null;
}

let servidor: Servidor;
let database: ReturnType<typeof criarBancoDeTeste>;
let gatilhos: ReturnType<typeof instalarGatilhosFalsos>;
let proximoUuid = 0;

function pullDoServidor(): SyncPullResponse {
  const base = syncPullFixture.changes;
  return {
    timestamp: syncPullFixture.timestamp + 60_000 * (servidor.avarias.length + servidor.atestados.length),
    changes: {
      ...base,
      avarias: {
        created: [],
        deleted: [],
        updated: [
          ...base.avarias.updated,
          ...servidor.avarias.map(({ corpo }, i) => ({
            id: String(100 + i),
            id_cliente: String(corpo.idCliente),
            peca_id: String(corpo.pecaId),
            peca_descricao: 'Armário aéreo 80cm',
            ambiente_nome: 'Cozinha',
            numero_pedido: 'PED-2026-0012',
            tipo_avaria_id: String(corpo.tipoAvariaId),
            descricao: String(corpo.descricao),
            status: StatusAvaria.REPORTADA,
            analisada_em: null,
            parecer: null,
            criado_em: '2026-10-17T10:00:00.000Z',
          })),
        ],
      },
      atestados: {
        created: [],
        deleted: [],
        updated: [
          ...base.atestados.updated,
          ...servidor.atestados.map(({ corpo }, i) => ({
            id: String(200 + i),
            id_cliente: String(corpo.idCliente),
            data_inicio: String(corpo.dataInicio),
            data_fim: String(corpo.dataFim),
            observacao: null,
            status: StatusAtestado.PENDENTE,
            motivo_rejeicao: null,
            validado_em: null,
            criado_em: '2026-10-17T10:00:00.000Z',
          })),
        ],
      },
    },
  };
}

async function fetchDoServidor(url: unknown, init?: RequestInit): Promise<Response> {
  if (!servidor.online) throw SEM_REDE;
  const caminho = String(url);
  const corpo = init?.body ? JSON.parse(String(init.body)) : null;

  if (caminho.includes('/api/sync/pull')) return respostaJson(200, pullDoServidor());
  if (caminho.includes('/api/avarias') || caminho.includes('/api/atestados')) {
    if (servidor.recusa) return respostaJson(422, servidor.recusa);
    (caminho.includes('/api/avarias') ? servidor.avarias : servidor.atestados).push({ corpo });
    return respostaJson(201, { id: 1 });
  }
  return respostaJson(404, { codigo: 'NAO_ENCONTRADO', message: 'rota desconhecida' });
}

function Tela({ children }: { children: ReactNode }) {
  return <ProvedorSincronizacao>{children}</ProvedorSincronizacao>;
}

async function renderizar(tela: ReactNode) {
  await render(<Tela>{tela}</Tela>, { wrapper: comBanco(database) });
}

async function anexarFoto(rotuloDoBotao: string) {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockImplementation(async () => ({
    canceled: false,
    assets: [{ uri: criarFotoDoPicker(), mimeType: 'image/jpeg' } as never],
  }));
  const espiaAlerta = jest.spyOn(Alert, 'alert');
  await fireEvent.press(screen.getByLabelText(rotuloDoBotao));
  const botoes = espiaAlerta.mock.calls[espiaAlerta.mock.calls.length - 1][2] ?? [];
  await act(async () => {
    await botoes.find((botao) => botao.text === 'Escolher da galeria')?.onPress?.(undefined as never);
  });
}

/** Avarias: escolhe peça e tipo, descreve, anexa duas fotos e toca em enviar. */
async function reportarAvariaComDuasFotos() {
  await waitFor(() => expect(screen.getByText('Armário aéreo 80cm')).toBeTruthy());
  await fireEvent.press(screen.getByText('Armário aéreo 80cm'));
  await fireEvent.press(screen.getByText('Peça faltando'));
  await fireEvent.changeText(
    screen.getByPlaceholderText('O que aconteceu com a peça?'),
    'Não veio na entrega',
  );
  for (const n of [1, 2]) {
    await anexarFoto('Fotografar problema');
    await waitFor(() => expect(screen.getByLabelText(`Foto ${n} do problema`)).toBeTruthy());
  }
  await fireEvent.press(screen.getByText('Enviar problema'));
}

/** Atestados: datas, duas fotos e enviar. */
async function enviarAtestadoComDuasFotos() {
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[0], '15102026');
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[1], '16102026');
  for (const n of [1, 2]) {
    await anexarFoto('Fotografar Atestado');
    await waitFor(() => expect(screen.getByLabelText(`Foto ${n} do atestado`)).toBeTruthy());
  }
  await fireEvent.press(screen.getByText('Enviar Atestado'));
}

const acoesNaFila = (status?: string) =>
  database
    .get<AcaoPendente>('acoes_pendentes')
    .query(...(status ? [Q.where('status', status)] : []))
    .fetch();

beforeEach(async () => {
  jest.clearAllMocks();
  proximoUuid = 0;
  jest.mocked(randomUUID).mockImplementation(() => `uuid-do-aparelho-${(proximoUuid += 1)}`);
  servidor = { online: false, avarias: [], atestados: [], recusa: null };
  globalThis.fetch = jest.fn(fetchDoServidor) as unknown as typeof fetch;
  definirTokens({ accessToken: 'token', refreshToken: 'refresh' });
  reiniciarStatusDaSincronizacao();
  gatilhos = instalarGatilhosFalsos();
  database = criarBancoDeTeste();
  // Réplica preenchida por um pull anterior; agora o aparelho está sem rede.
  await gravarPullNaReplica(database, syncPullFixture);
});

afterEach(async () => {
  await apagarTodasAsFotos();
});

describe('avaria sem rede', () => {
  it('abre o formulário com a réplica, enfileira com 2 fotos, aparece aguardando envio e sobe quando a rede volta', async () => {
    await renderizar(<Avarias />);

    // Sem rede o formulário está lá, com pedido, peças e tipos da réplica.
    await waitFor(() => expect(screen.getByText('Enviar problema')).toBeTruthy());
    expect(screen.getByText('PED-2026-0012 · Residencial Acácias')).toBeTruthy();
    expect(screen.queryByText('Não foi possível carregar')).toBeNull();

    await reportarAvariaComDuasFotos();

    // Enfileirada: caminhos (não base64) na fila, arquivos no aparelho, selo na lista.
    await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
    const [pendente] = await acoesNaFila('pendente');
    const payload = JSON.parse(pendente.payload);
    expect(pendente.tipo).toBe('avaria');
    expect(payload.fotosCaminhos).toHaveLength(2);
    expect(pendente.payload).not.toContain(base64DeTexto('foto'));
    expect(fotosGuardadas()).toHaveLength(2);
    expect(servidor.avarias).toHaveLength(0);

    // A conexão volta: a fila sobe (fotos em base64), o pull devolve a avaria e o selo some.
    servidor.online = true;
    await act(async () => {
      gatilhos.emitirRede(true);
    });

    await waitFor(() => expect(servidor.avarias).toHaveLength(1));
    expect(servidor.avarias[0].corpo).toMatchObject({
      idCliente: 'uuid-do-aparelho-1',
      pecaId: 301,
      tipoAvariaId: 2,
      descricao: 'Não veio na entrega',
      fotos: [
        { conteudoBase64: base64DeTexto('foto'), mimeType: 'image/jpeg' },
        { conteudoBase64: base64DeTexto('foto'), mimeType: 'image/jpeg' },
      ],
    });
    await waitFor(() => expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull());
    await waitFor(async () => expect(await acoesNaFila()).toHaveLength(0));
    expect(fotosGuardadas()).toEqual([]);
    // O reporte continua na lista — agora vindo da réplica, uma vez só.
    expect(screen.getAllByText('Armário aéreo 80cm').length).toBeGreaterThan(1);
    expect(screen.getAllByText('ENVIADA')).toHaveLength(1);
  });

  it('recusa de regra na subida: a ação sai da fila, o aviso fica no app e os arquivos são apagados', async () => {
    await renderizar(<Avarias />);
    await reportarAvariaComDuasFotos();
    await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
    expect(fotosGuardadas()).toHaveLength(2);

    servidor.online = true;
    servidor.recusa = { codigo: 'PECA_NAO_ALOCADA', message: 'Peça não pertence ao montador' };
    await act(async () => {
      gatilhos.emitirRede(true);
    });

    await waitFor(async () => expect(await acoesNaFila()).toHaveLength(0));
    expect(fotosGuardadas()).toEqual([]);
    await waitFor(() => expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull());
    expect(servidor.avarias).toHaveLength(0);
  });
});

describe('atestado sem rede', () => {
  it('enfileira com 2 fotos, aparece aguardando envio e sobe quando a rede volta', async () => {
    await renderizar(<Atestados />);
    await waitFor(() => expect(screen.getByText('Enviar Atestado')).toBeTruthy());
    expect(screen.queryByText('Não foi possível carregar seus atestados')).toBeNull();

    await enviarAtestadoComDuasFotos();

    await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
    const [pendente] = await acoesNaFila('pendente');
    const payload = JSON.parse(pendente.payload);
    expect(pendente.tipo).toBe('atestado');
    expect(payload).toMatchObject({ dataInicio: '2026-10-15', dataFim: '2026-10-16' });
    expect(payload.fotosCaminhos).toHaveLength(2);
    expect(pendente.payload).not.toContain(base64DeTexto('foto'));
    expect(fotosGuardadas()).toHaveLength(2);

    servidor.online = true;
    await act(async () => {
      gatilhos.emitirRede(true);
    });

    await waitFor(() => expect(servidor.atestados).toHaveLength(1));
    expect(servidor.atestados[0].corpo).toMatchObject({
      idCliente: 'uuid-do-aparelho-1',
      dataInicio: '2026-10-15',
      dataFim: '2026-10-16',
      fotos: [
        { conteudoBase64: base64DeTexto('foto'), mimeType: 'image/jpeg' },
        { conteudoBase64: base64DeTexto('foto'), mimeType: 'image/jpeg' },
      ],
    });
    await waitFor(() => expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull());
    await waitFor(async () => expect(await acoesNaFila()).toHaveLength(0));
    expect(fotosGuardadas()).toEqual([]);
    // O atestado antigo da réplica (recusado) e o novo (em análise), cada um uma vez.
    expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(1);
    expect(screen.getAllByText('RECUSADO')).toHaveLength(1);
  });

  it('recusa do servidor com a rede de volta: a ação sai da fila e os arquivos são apagados', async () => {
    await renderizar(<Atestados />);
    await waitFor(() => expect(screen.getByText('Enviar Atestado')).toBeTruthy());
    await enviarAtestadoComDuasFotos();
    await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());

    servidor.online = true;
    servidor.recusa = { codigo: 'PERIODO_ATESTADO_INVALIDO', message: 'Período inválido' };
    await act(async () => {
      gatilhos.emitirRede(true);
    });

    await waitFor(async () => expect(await acoesNaFila()).toHaveLength(0));
    expect(fotosGuardadas()).toEqual([]);
    await waitFor(() => expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull());
    expect(servidor.atestados).toHaveLength(0);
  });
});
