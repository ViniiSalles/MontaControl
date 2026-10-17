jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));
jest.mock('../../../atestados/clienteAtestados', () => ({ enviarAtestado: jest.fn() }));

import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { enviarAtestado } from '../../../atestados/clienteAtestados';
import { NovoAtestado } from '../NovoAtestado';

const enviarMock = jest.mocked(enviarAtestado);
const requestCameraMock = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const launchCameraMock = jest.mocked(ImagePicker.launchCameraAsync);

const enviado = jest.fn();

function renderizar() {
  return render(<NovoAtestado aoEnviado={enviado} />);
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

beforeEach(() => {
  jest.clearAllMocks();
  requestCameraMock.mockResolvedValue({ granted: true, status: 'granted', expires: 'never', canAskAgain: true } as never);
  launchCameraMock.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://foto.jpg', base64: 'abc123', mimeType: 'image/jpeg' } as never],
  });
});

test('formulário sem data e sem foto não chega à rede e aponta os campos', async () => {
  await renderizar();

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  expect(enviarMock).not.toHaveBeenCalled();
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
});

test('remover foto tira a miniatura da lista', async () => {
  await renderizar();
  await tirarFoto();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());

  await fireEvent.press(screen.getByLabelText('Remover foto 1'));

  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
});

test('envia o atestado com as datas em ISO, id do aparelho e a foto anexada', async () => {
  enviarMock.mockResolvedValue({ id: 1 } as never);
  await renderizar();
  await preencherDatas('01092026', '03092026');
  await tirarFoto();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  await waitFor(() =>
    expect(enviarMock).toHaveBeenCalledWith({
      idCliente: '11111111-1111-4111-8111-111111111111',
      dataInicio: '2026-09-01',
      dataFim: '2026-09-03',
      fotos: [{ conteudoBase64: 'abc123', mimeType: 'image/jpeg' }],
    }),
  );
  expect(enviado).toHaveBeenCalled();
});

test('recusa da API mostra a mensagem de erro', async () => {
  enviarMock.mockRejectedValue(new Error('offline'));
  await renderizar();
  await preencherDatas('01092026', '03092026');
  await tirarFoto();
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  await waitFor(() => expect(screen.getByText('Não foi possível enviar. Tente de novo.')).toBeTruthy());
  expect(enviado).not.toHaveBeenCalled();
});

test('permissão negada mostra aviso e não abre o picker', async () => {
  requestCameraMock.mockResolvedValue({ granted: false, status: 'denied', expires: 'never', canAskAgain: true } as never);
  await renderizar();

  await tirarFoto();

  await waitFor(() => expect(screen.getByText(/sem permissão de acesso/i)).toBeTruthy());
  expect(launchCameraMock).not.toHaveBeenCalled();
});

test('envia a observação digitada e zera o formulário após o sucesso', async () => {
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
