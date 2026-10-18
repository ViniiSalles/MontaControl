jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('../../../atestados/clienteAtestados', () => ({ enviarAtestado: jest.fn() }));

import { Q } from '@nozbe/watermelondb';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { enviarAtestado } from '../../../atestados/clienteAtestados';
import { criarBancoDeTeste } from '../../../db/__tests__/apoio';
import { comBanco } from '../../../db/__tests__/apoioReact';
import { AcaoPendente } from '../../../db/AcaoPendente';
import { apagarTodasAsFotos } from '../../../fotos/armazenamentoFotos';
import { criarFotoDoPicker, fotosGuardadas } from '../../../fotos/__tests__/apoio';
import { ErroApi } from '../../../http/erroApi';
import { NovoAtestado } from '../NovoAtestado';

const enviarMock = jest.mocked(enviarAtestado);
const requestCameraMock = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const launchCameraMock = jest.mocked(ImagePicker.launchCameraAsync);

const enviado = jest.fn();

let database: ReturnType<typeof criarBancoDeTeste>;

function renderizar() {
  return render(<NovoAtestado aoEnviado={enviado} />, { wrapper: comBanco(database) });
}

async function preencherDatas(inicio: string, fim: string) {
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[0], inicio);
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[1], fim);
}

/** Simula o toque em "Adicionar foto" → menu nativo → escolhe a câmera. */
async function tirarFoto() {
  const espiaAlerta = jest.spyOn(Alert, 'alert');
  await fireEvent.press(screen.getByLabelText('Fotografar Atestado'));
  const botoes = espiaAlerta.mock.calls[espiaAlerta.mock.calls.length - 1][2] ?? [];
  const tirarFoto = botoes.find((botao) => botao.text === 'Tirar foto');
  await tirarFoto?.onPress?.(undefined as never);
}

async function preencherEEnviar(fotos = 1) {
  await preencherDatas('01092026', '03092026');
  for (let i = 0; i < fotos; i += 1) {
    await tirarFoto();
    await waitFor(() => expect(screen.getByLabelText(`Foto ${i + 1} do atestado`)).toBeTruthy());
  }
  await fireEvent.press(screen.getByText('Enviar Atestado'));
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  requestCameraMock.mockResolvedValue({ granted: true, status: 'granted', expires: 'never', canAskAgain: true } as never);
  launchCameraMock.mockImplementation(async () => ({
    canceled: false,
    assets: [{ uri: criarFotoDoPicker('atestado'), mimeType: 'image/jpeg' } as never],
  }));
});

afterEach(async () => {
  await apagarTodasAsFotos();
});

test('formulário sem data e sem foto não chega à rede nem à fila e aponta os campos', async () => {
  await renderizar();

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  expect(enviarMock).not.toHaveBeenCalled();
  expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0);
  expect(screen.getAllByText(/DD\/MM\/AAAA/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/anexe ao menos uma foto/i)).toBeTruthy();
});

test('tirar foto mostra a miniatura e limpa o erro de fotos', async () => {
  await renderizar();
  await fireEvent.press(screen.getByText('Enviar Atestado')); // gera o erro "anexe ao menos uma foto"
  expect(screen.getByText(/anexe ao menos uma foto/i)).toBeTruthy();

  await tirarFoto();

  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());
  expect(screen.queryByText(/anexe ao menos uma foto/i)).toBeNull();
  expect(fotosGuardadas()).toHaveLength(1);
});

test('foto em formato que a API não aceita (HEIC) é recusada com aviso', async () => {
  launchCameraMock.mockResolvedValue({
    canceled: false,
    assets: [{ uri: criarFotoDoPicker('x', 'heic'), mimeType: 'image/heic' } as never],
  });
  await renderizar();

  await tirarFoto();

  await waitFor(() => expect(screen.getByText('Não foi possível usar essa foto. Tente outra.')).toBeTruthy());
  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
  expect(fotosGuardadas()).toEqual([]);
});

test('remover foto tira a miniatura da lista e apaga o arquivo', async () => {
  await renderizar();
  await tirarFoto();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Remover foto 1'));

  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
  await waitFor(() => expect(fotosGuardadas()).toEqual([]));
});

test('envia o atestado pela fila: datas em ISO, id do aparelho e a foto convertida só no envio', async () => {
  enviarMock.mockResolvedValue({ id: 1 } as never);
  await renderizar();

  await preencherEEnviar();

  await waitFor(() => expect(enviado).toHaveBeenCalledWith('Atestado enviado. O RH vai analisar.'));
  expect(enviarMock).toHaveBeenCalledWith({
    idCliente: '11111111-1111-4111-8111-111111111111',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-03',
    fotos: [{ conteudoBase64: Buffer.from('atestado').toString('base64'), mimeType: 'image/jpeg' }],
  });
  // Aceito: fica `enviada` (aguardando o pull) e o arquivo da foto já foi apagado.
  const [acao] = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
  expect(acao.status).toBe('enviada');
  expect(fotosGuardadas()).toEqual([]);
});

test('sem rede o atestado fica na fila com as duas fotos como caminhos e o aviso diz que será enviado', async () => {
  enviarMock.mockRejectedValue(new TypeError('Network request failed'));
  await renderizar();

  await preencherEEnviar(2);

  await waitFor(() =>
    expect(enviado).toHaveBeenCalledWith(
      'Sem conexão agora: o atestado foi salvo e será enviado automaticamente.',
    ),
  );
  const [pendente] = await database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('status', 'pendente'))
    .fetch();
  const payload = JSON.parse(pendente.payload);
  expect(pendente.tipo).toBe('atestado');
  expect(payload.fotosCaminhos).toHaveLength(2);
  expect(payload).not.toHaveProperty('fotos');
  expect(fotosGuardadas().sort()).toEqual([...payload.fotosCaminhos].sort());
  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
});

test('recusa do servidor mostra a mensagem, mantém as datas e descarta as fotos', async () => {
  enviarMock.mockRejectedValue(
    new ErroApi('PERIODO_ATESTADO_INVALIDO', 'A data do atestado não pode ser futura.', 422),
  );
  await renderizar();

  await preencherEEnviar(2);

  await waitFor(() => expect(screen.getByText(/A data do atestado não pode ser futura\./)).toBeTruthy());
  expect(enviado).not.toHaveBeenCalled();
  expect(screen.getAllByPlaceholderText('DD/MM/AAAA')[0].props.value).toBe('01/09/2026');
  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
  expect(fotosGuardadas()).toEqual([]);
  expect(await database.get('acoes_pendentes').query().fetchCount()).toBe(0);
});

test('permissão negada mostra aviso e não abre o picker', async () => {
  requestCameraMock.mockResolvedValue({ granted: false, status: 'denied', expires: 'never', canAskAgain: true } as never);
  await renderizar();

  await tirarFoto();

  await waitFor(() => expect(screen.getByText(/sem permissão de acesso/i)).toBeTruthy());
  expect(launchCameraMock).not.toHaveBeenCalled();
});

test('envia a observação digitada e zera o formulário após o envio', async () => {
  enviarMock.mockResolvedValue({ id: 1 } as never);
  await renderizar();
  await preencherDatas('01092026', '03092026');
  await tirarFoto();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText(/Descreva brevemente/), 'Dor lombar');

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  await waitFor(() =>
    expect(enviarMock).toHaveBeenCalledWith(expect.objectContaining({ observacao: 'Dor lombar' })),
  );
  await waitFor(() => expect(enviado).toHaveBeenCalled());
  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
  expect(screen.getByPlaceholderText(/Descreva brevemente/).props.value).toBe('');
});
