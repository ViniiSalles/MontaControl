jest.mock('../../avarias/clienteAvarias', () => ({ enviarAvaria: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

import { Q } from '@nozbe/watermelondb';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StatusAvaria, syncPullFixture } from '@montacontrol/shared';
import { enviarAvaria } from '../../avarias/clienteAvarias';
import { criarBancoDeTeste, gravarLinhasNaReplica, gravarPullNaReplica } from '../../db/__tests__/apoio';
import { comBancoESincronizacao } from '../../db/__tests__/apoioReact';
import { AcaoPendente } from '../../db/AcaoPendente';
import { apagarTodasAsFotos } from '../../fotos/armazenamentoFotos';
import { criarFotoDoPicker, fotosGuardadas } from '../../fotos/__tests__/apoio';
import { ErroApi } from '../../http/erroApi';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { useUiStore } from '../../estado/uiStore';
import { instalarDiscoEmMemoria } from '../../estado/__tests__/apoio';
import { drenarFila } from '../../sincronizacao/syncManager';
import { Avarias } from '../Avarias';

const enviarMock = jest.mocked(enviarAvaria);
const AVARIA_DA_REPLICA = syncPullFixture.changes.avarias.updated[0];

async function bancoComReplica() {
  const database = criarBancoDeTeste();
  await gravarPullNaReplica(database, syncPullFixture);
  return database;
}

async function renderizar(database: ReturnType<typeof criarBancoDeTeste>) {
  await render(<Avarias />, { wrapper: comBancoESincronizacao(database) });
}

/** Toca em "Fotografar problema" e escolhe uma foto da galeria (o picker devolve o arquivo temporário). */
async function anexarFotoDaGaleria() {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: criarFotoDoPicker(), mimeType: 'image/jpeg' } as never],
  });
  const espiaAlerta = jest.spyOn(Alert, 'alert');
  await fireEvent.press(screen.getByLabelText('Fotografar problema'));
  const botoes = espiaAlerta.mock.calls[espiaAlerta.mock.calls.length - 1][2] ?? [];
  await act(async () => {
    await botoes.find((botao) => botao.text === 'Escolher da galeria')?.onPress?.(undefined as never);
  });
}

async function preencherEEnviar(comFotos = 0) {
  await waitFor(() => expect(screen.getByText('Armário aéreo 80cm')).toBeTruthy());
  await fireEvent.press(screen.getByText('Armário aéreo 80cm'));
  await fireEvent.press(screen.getByText('Peça faltando'));
  await fireEvent.changeText(
    screen.getByPlaceholderText('O que aconteceu com a peça?'),
    'Não veio na entrega',
  );
  for (let i = 0; i < comFotos; i += 1) {
    await anexarFotoDaGaleria();
    await waitFor(() => expect(screen.getByLabelText(`Foto ${i + 1} do problema`)).toBeTruthy());
  }
  await fireEvent.press(screen.getByText('Enviar problema'));
}

let disco: ReturnType<typeof instalarDiscoEmMemoria>;

beforeEach(() => {
  jest.clearAllMocks();
  useSincronizacaoStore.getState().reiniciar();
  // O rascunho mora no store global persistido: cada teste começa com ele vazio.
  disco = instalarDiscoEmMemoria();
  useUiStore.getState().reiniciar();
});

afterEach(async () => {
  await apagarTodasAsFotos();
});

test('lista os reportes da réplica com situação e parecer do gestor', async () => {
  const database = await bancoComReplica();
  await gravarLinhasNaReplica(database, 'avarias', [
    {
      ...AVARIA_DA_REPLICA,
      id: '78',
      id_cliente: 'outra',
      status: StatusAvaria.RESOLVIDA,
      parecer: 'Peça reposta',
      criado_em: '2026-10-17T09:00:00.000Z',
    },
  ]);

  await renderizar(database);

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
  expect(screen.getByText('RESOLVIDA')).toBeTruthy();
  expect(screen.getByText('Gestor: Peça reposta')).toBeTruthy();
  expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull();
});

// Regressão: com um pedido só, a lista de pedidos sumia e o montador achava
// que o vínculo não tinha chegado.
test('mostra o pedido vinculado com o cliente mesmo quando é o único', async () => {
  await renderizar(await bancoComReplica());

  await waitFor(() =>
    expect(screen.getByText('PED-2026-0012 · Residencial Acácias')).toBeTruthy(),
  );
  expect(screen.getByText('Rua das Acácias, 120 · Belo Horizonte/MG')).toBeTruthy();
});

test('sem pedido vinculado não mostra o formulário', async () => {
  await renderizar(criarBancoDeTeste());

  await waitFor(() => expect(screen.getByText('Nenhum pedido vinculado')).toBeTruthy());
  expect(screen.queryByText('Enviar problema')).toBeNull();
});

test('réplica vazia depois de uma sincronização que falhou pede para conectar e tentar de novo', async () => {
  await renderizar(criarBancoDeTeste());
  await waitFor(() => expect(screen.getByText('Nenhum pedido vinculado')).toBeTruthy());

  await act(async () => {
    useSincronizacaoStore.setState({ ultimoErro: 'sem_rede' });
  });

  await waitFor(() => expect(screen.getByText('Não foi possível carregar')).toBeTruthy());
  expect(screen.getByText('Tentar de novo')).toBeTruthy();
});

test('enviar sem escolher peça e tipo mostra os erros e não envia', async () => {
  const database = await bancoComReplica();
  await renderizar(database);
  await waitFor(() => expect(screen.getByText('Enviar problema')).toBeTruthy());

  await fireEvent.press(screen.getByText('Enviar problema'));

  expect(screen.getByText('Selecione a peça com problema.')).toBeTruthy();
  expect(screen.getByText('Selecione o tipo de problema.')).toBeTruthy();
  expect(enviarMock).not.toHaveBeenCalled();
  expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0);
});

test('com pedido único, escolhe peça e tipo e envia pela outbox', async () => {
  enviarMock.mockResolvedValue({} as never);
  const database = await bancoComReplica();
  await renderizar(database);

  await preencherEEnviar();

  await waitFor(() =>
    expect(screen.getByText('Problema enviado. O gestor vai analisar.')).toBeTruthy(),
  );
  expect(enviarMock).toHaveBeenCalledWith({
    idCliente: '11111111-1111-4111-8111-111111111111',
    pecaId: 301,
    tipoAvariaId: 2,
    descricao: 'Não veio na entrega',
  });
  // Aceita, aparece na lista sem selo enquanto o pull não a devolve.
  await waitFor(() => expect(screen.getAllByText('Armário aéreo 80cm').length).toBeGreaterThan(1));
  expect(screen.queryByText('AGUARDANDO ENVIO')).toBeNull();
});

test('sem rede avisa que o reporte foi salvo e o mostra em "Meus reportes" aguardando envio', async () => {
  enviarMock.mockRejectedValue(new TypeError('Network request failed'));
  const database = await bancoComReplica();
  await renderizar(database);

  await preencherEEnviar();

  await waitFor(() =>
    expect(
      screen.getByText('Sem conexão agora: o problema foi salvo e será enviado automaticamente.'),
    ).toBeTruthy(),
  );
  await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
  expect(screen.getAllByText('Armário aéreo 80cm').length).toBeGreaterThan(1);
});

test('sem rede, com duas fotos: a fila guarda só os caminhos e os arquivos ficam no aparelho', async () => {
  enviarMock.mockRejectedValue(new TypeError('Network request failed'));
  const database = await bancoComReplica();
  await renderizar(database);

  await preencherEEnviar(2);

  await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
  const [pendente] = await database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('status', 'pendente'))
    .fetch();
  const payload = JSON.parse(pendente.payload);
  expect(payload.fotosCaminhos).toHaveLength(2);
  expect(payload).not.toHaveProperty('fotos');
  expect(fotosGuardadas().sort()).toEqual([...payload.fotosCaminhos].sort());
  // O formulário foi zerado, mas as fotos agora são da fila.
  expect(screen.queryByLabelText('Foto 1 do problema')).toBeNull();
});

test('recusa do servidor mostra a mensagem, mantém os campos e descarta as fotos', async () => {
  enviarMock.mockRejectedValue(new ErroApi('PECA_NAO_ENCONTRADA', 'Peça não encontrada', 404));
  const database = await bancoComReplica();
  await renderizar(database);

  await preencherEEnviar(1);

  await waitFor(() => expect(screen.getByText(/Peça não encontrada/)).toBeTruthy());
  expect(screen.getByDisplayValue('Não veio na entrega')).toBeTruthy();
  expect(screen.queryByLabelText('Foto 1 do problema')).toBeNull();
  expect(fotosGuardadas()).toEqual([]);
  expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0);
});

test('remover uma foto antes de enviar apaga o arquivo', async () => {
  const database = await bancoComReplica();
  await renderizar(database);
  await waitFor(() => expect(screen.getByText('Enviar problema')).toBeTruthy());
  await anexarFotoDaGaleria();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do problema')).toBeTruthy());
  expect(fotosGuardadas()).toHaveLength(1);

  await fireEvent.press(screen.getByLabelText('Remover foto 1'));

  expect(screen.queryByLabelText('Foto 1 do problema')).toBeNull();
  await waitFor(() => expect(fotosGuardadas()).toEqual([]));
});

test('fechar a tela sem enviar mantém o rascunho e as fotos: ao voltar, está tudo lá', async () => {
  const database = await bancoComReplica();
  await renderizar(database);
  await waitFor(() => expect(screen.getByText('Armário aéreo 80cm')).toBeTruthy());
  await fireEvent.press(screen.getByText('Armário aéreo 80cm'));
  await fireEvent.press(screen.getByText('Peça faltando'));
  await fireEvent.changeText(screen.getByPlaceholderText('O que aconteceu com a peça?'), 'Rascunho');
  await anexarFotoDaGaleria();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do problema')).toBeTruthy());
  const [nome] = fotosGuardadas();

  await screen.unmount();
  // O formulário não apaga nada ao fechar: o rascunho é o dono da foto.
  expect(fotosGuardadas()).toEqual([nome]);
  await renderizar(database);

  await waitFor(() => expect(screen.getByDisplayValue('Rascunho')).toBeTruthy());
  expect(screen.getByLabelText('Foto 1 do problema')).toBeTruthy();
  expect(fotosGuardadas()).toEqual([nome]);
});

test('fechar e reabrir o app mantém o rascunho de avaria: campos e fotos (os nomes)', async () => {
  const database = await bancoComReplica();
  await renderizar(database);
  await waitFor(() => expect(screen.getByText('Armário aéreo 80cm')).toBeTruthy());
  await fireEvent.press(screen.getByText('Armário aéreo 80cm'));
  await fireEvent.press(screen.getByText('Peça faltando'));
  await fireEvent.changeText(screen.getByPlaceholderText('O que aconteceu com a peça?'), 'Rascunho');
  await anexarFotoDaGaleria();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do problema')).toBeTruthy());
  const [nome] = fotosGuardadas();
  await screen.unmount();

  await act(async () => {
    await disco.fecharEReabrirOApp();
  });
  expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([nome]);
  await renderizar(database);

  await waitFor(() => expect(screen.getByDisplayValue('Rascunho')).toBeTruthy());
  expect(screen.getByLabelText('Foto 1 do problema')).toBeTruthy();
  // E o que volta é enviável: a fila recebe o mesmo arquivo.
  enviarMock.mockRejectedValue(new TypeError('Network request failed'));
  await fireEvent.press(screen.getByText('Enviar problema'));
  await waitFor(() => expect(screen.getByText('AGUARDANDO ENVIO')).toBeTruthy());
  const [pendente] = await database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('status', 'pendente'))
    .fetch();
  expect(JSON.parse(pendente.payload)).toMatchObject({
    pecaId: 301,
    tipoAvariaId: 2,
    descricao: 'Rascunho',
    fotosCaminhos: [nome],
  });
});

test('rascunho com pedido, peça e tipo que a réplica já não tem não é enviado com esses ids', async () => {
  useUiStore.getState().alterarRascunhoAvaria({
    pedidoId: 9999,
    campos: { pecaId: 9999, tipoAvariaId: 9999, descricao: 'De uma réplica antiga' },
  });
  await renderizar(await bancoComReplica());
  await waitFor(() => expect(screen.getByDisplayValue('De uma réplica antiga')).toBeTruthy());

  await fireEvent.press(screen.getByText('Enviar problema'));

  expect(screen.getByText('Selecione a peça com problema.')).toBeTruthy();
  expect(screen.getByText('Selecione o tipo de problema.')).toBeTruthy();
  expect(enviarMock).not.toHaveBeenCalled();
});

test('Descartar rascunho apaga os arquivos das fotos e esvazia o formulário', async () => {
  const database = await bancoComReplica();
  await renderizar(database);
  await waitFor(() => expect(screen.getByText('Armário aéreo 80cm')).toBeTruthy());
  expect(screen.queryByText('Descartar rascunho')).toBeNull();
  await fireEvent.changeText(screen.getByPlaceholderText('O que aconteceu com a peça?'), 'Rascunho');
  await anexarFotoDaGaleria();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do problema')).toBeTruthy());
  expect(fotosGuardadas()).toHaveLength(1);

  await fireEvent.press(screen.getByText('Descartar rascunho'));

  await waitFor(() => expect(fotosGuardadas()).toEqual([]));
  expect(screen.queryByLabelText('Foto 1 do problema')).toBeNull();
  expect(screen.queryByDisplayValue('Rascunho')).toBeNull();
  expect(screen.queryByText('Descartar rascunho')).toBeNull();
  expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([]);
});

test('desmontar a tela com o envio ainda pendurado na rede não perde as fotos: a fila é a dona e sobe depois com as duas', async () => {
  let soltarEnvio!: (erro: Error) => void;
  enviarMock.mockImplementationOnce(
    () =>
      new Promise((_resolver, rejeitar) => {
        soltarEnvio = rejeitar;
      }),
  );
  const database = await bancoComReplica();
  await renderizar(database);
  await waitFor(() => expect(screen.getByText('Armário aéreo 80cm')).toBeTruthy());
  await fireEvent.press(screen.getByText('Armário aéreo 80cm'));
  await fireEvent.press(screen.getByText('Peça faltando'));
  await fireEvent.changeText(
    screen.getByPlaceholderText('O que aconteceu com a peça?'),
    'Não veio na entrega',
  );
  for (const n of [1, 2]) {
    await anexarFotoDaGaleria();
    await waitFor(() => expect(screen.getByLabelText(`Foto ${n} do problema`)).toBeTruthy());
  }

  await fireEvent.press(screen.getByText('Enviar problema'));
  await waitFor(() => expect(enviarMock).toHaveBeenCalledTimes(1));

  // As fotos já são da fila: saem do formulário na hora e não há o que remover durante o envio.
  expect(screen.queryByLabelText('Foto 1 do problema')).toBeNull();
  expect(screen.queryByLabelText('Remover foto 1')).toBeNull();

  // O montador troca de aba (a tela desmonta) com o fetch ainda pendurado.
  await screen.unmount();
  expect(fotosGuardadas()).toHaveLength(2);
  soltarEnvio(new TypeError('Network request failed'));
  await waitFor(async () =>
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(1),
  );
  expect(fotosGuardadas()).toHaveLength(2);

  // A conexão volta: a linha enfileirada sobe com as duas fotos.
  enviarMock.mockResolvedValue({} as never);
  await drenarFila(database);

  const corpo = enviarMock.mock.calls[1][0];
  expect(corpo.fotos).toHaveLength(2);
  expect(corpo.fotos?.[0].conteudoBase64.length).toBeGreaterThan(0);
  expect(fotosGuardadas()).toEqual([]);
});

test('falha ao registrar (enfileiramento) avisa que as fotos foram descartadas e não deixa arquivo', async () => {
  const database = await bancoComReplica();
  jest.spyOn(database, 'write').mockRejectedValueOnce(new Error('disco cheio'));
  await renderizar(database);

  await preencherEEnviar(1);

  await waitFor(() => expect(screen.getByText(/Não foi possível registrar o problema/)).toBeTruthy());
  expect(screen.getByText(/As fotos anexadas foram descartadas/)).toBeTruthy();
  expect(fotosGuardadas()).toEqual([]);
});
