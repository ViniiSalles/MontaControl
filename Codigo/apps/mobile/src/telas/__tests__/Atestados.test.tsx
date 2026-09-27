jest.mock('../../auth/AuthContext');
jest.mock('../../atestados/clienteAtestados', () => ({
  listarMeusAtestados: jest.fn(),
  enviarAtestado: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StatusAtestado } from '@montacontrol/shared';
import type { AtestadoDTO } from '@montacontrol/shared';
import { useAuth } from '../../auth/AuthContext';
import { enviarAtestado, listarMeusAtestados } from '../../atestados/clienteAtestados';
import { montador } from '../../auth/__tests__/apoio';
import { Atestados } from '../Atestados';

const useAuthMock = jest.mocked(useAuth);
const listarMock = jest.mocked(listarMeusAtestados);
const enviarMock = jest.mocked(enviarAtestado);

function atestadoFake(parcial: Partial<AtestadoDTO> = {}): AtestadoDTO {
  return {
    id: 1,
    usuarioId: montador.id,
    usuarioNome: montador.nome,
    dataInicio: '2026-09-01',
    dataFim: '2026-09-03',
    observacao: null,
    status: StatusAtestado.PENDENTE,
    motivoRejeicao: null,
    validadoPor: null,
    validadoEm: null,
    criadoEm: '2026-09-01T12:00:00.000Z',
    ...parcial,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthMock.mockReturnValue({
    sessao: { accessToken: 'access', refreshToken: 'refresh', usuario: montador },
    restaurando: false,
    entrar: jest.fn(),
    sair: jest.fn(),
  });
  listarMock.mockResolvedValue([]);
});

test('lista os atestados com o rótulo de situação de cada um', async () => {
  listarMock.mockResolvedValue([
    atestadoFake({ id: 1, status: StatusAtestado.PENDENTE }),
    atestadoFake({ id: 2, status: StatusAtestado.VALIDADO }),
    atestadoFake({ id: 3, status: StatusAtestado.REJEITADO, motivoRejeicao: 'Foto ilegível' }),
  ]);

  await render(<Atestados />);

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
  expect(screen.getByText('APROVADO')).toBeTruthy();
  expect(screen.getByText('RECUSADO')).toBeTruthy();
  expect(screen.getByText('Foto ilegível')).toBeTruthy();
});

test('sem atestados mostra o estado vazio', async () => {
  await render(<Atestados />);

  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());
});

test('falha ao carregar mostra erro e permite tentar de novo', async () => {
  listarMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([atestadoFake()]);

  await render(<Atestados />);
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar seus atestados')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Tentar de novo'));

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
});

test('mostra o período no formato curto e o aviso LGPD', async () => {
  listarMock.mockResolvedValue([atestadoFake({ dataInicio: '2026-10-15', dataFim: '2026-10-17' })]);

  await render(<Atestados />);

  await waitFor(() => expect(screen.getByText('15/10 a 17/10 (3 dias)')).toBeTruthy());
  expect(screen.getByText('HISTÓRICO RECENTE')).toBeTruthy();
  expect(screen.getByText(/Aviso LGPD/)).toBeTruthy();
});

test('o formulário aparece direto, sem tocar em "Novo atestado"', async () => {
  await render(<Atestados />);

  expect(screen.getByText('Enviar Atestado')).toBeTruthy();
  expect(screen.queryByText('Novo atestado')).toBeNull();
});

test('enviar com observação chama a API, avisa, zera o formulário e recarrega a lista', async () => {
  enviarMock.mockResolvedValue(atestadoFake());
  listarMock.mockResolvedValueOnce([]).mockResolvedValueOnce([atestadoFake()]);
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://foto.jpg', base64: 'abc123', mimeType: 'image/jpeg' } as never],
  });

  await render(<Atestados />);
  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());

  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[0], '01092026');
  await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[1], '03092026');
  const espiaAlerta = jest.spyOn(Alert, 'alert');
  await fireEvent.press(screen.getByLabelText('Fotografar Atestado'));
  const botoes = espiaAlerta.mock.calls[espiaAlerta.mock.calls.length - 1][2] ?? [];
  await botoes.find((botao) => botao.text === 'Escolher da galeria')?.onPress?.(undefined as never);
  await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());
  await fireEvent.changeText(screen.getByPlaceholderText(/Descreva brevemente/), 'Dor lombar');

  await fireEvent.press(screen.getByText('Enviar Atestado'));

  await waitFor(() =>
    expect(enviarMock).toHaveBeenCalledWith(
      'access',
      expect.objectContaining({ observacao: 'Dor lombar', dataInicio: '2026-09-01' }),
    ),
  );
  await waitFor(() => expect(screen.getByText('Atestado enviado. O RH vai analisar.')).toBeTruthy());
  expect(screen.queryByLabelText('Foto 1 do atestado')).toBeNull();
  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
});

function atestadosFake(quantidade: number): AtestadoDTO[] {
  return Array.from({ length: quantidade }, (_, i) =>
    atestadoFake({ id: i + 1, criadoEm: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z` }),
  );
}

test('com mais de 5 atestados mostra só 5 cartões e o botão "Ver todos (N)"', async () => {
  listarMock.mockResolvedValue(atestadosFake(7));

  await render(<Atestados />);

  await waitFor(() => expect(screen.getByText('Ver todos (7)')).toBeTruthy());
  expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(5);
});

test('tocar em "Ver todos" mostra a lista inteira e o botão vira "Ver menos"', async () => {
  listarMock.mockResolvedValue(atestadosFake(7));

  await render(<Atestados />);
  await fireEvent.press(await screen.findByText('Ver todos (7)'));

  expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(7);
  expect(screen.getByText('Ver menos')).toBeTruthy();

  await fireEvent.press(screen.getByText('Ver menos'));

  expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(5);
  expect(screen.getByText('Ver todos (7)')).toBeTruthy();
});

test('com 5 atestados ou menos não mostra o botão de expandir', async () => {
  listarMock.mockResolvedValue(atestadosFake(5));

  await render(<Atestados />);

  await waitFor(() => expect(screen.getAllByText('EM ANÁLISE')).toHaveLength(5));
  expect(screen.queryByText(/Ver todos/)).toBeNull();
  expect(screen.queryByText('Ver menos')).toBeNull();
});

test('o aviso de sucesso some quando um novo envio começa', async () => {
  enviarMock.mockResolvedValueOnce(atestadoFake()).mockRejectedValueOnce(new Error('offline'));
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://foto.jpg', base64: 'abc123', mimeType: 'image/jpeg' } as never],
  });

  await render(<Atestados />);
  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());

  async function preencherEEnviar() {
    await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[0], '01092026');
    await fireEvent.changeText(screen.getAllByPlaceholderText('DD/MM/AAAA')[1], '03092026');
    const espiaAlerta = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByLabelText('Fotografar Atestado'));
    const botoes = espiaAlerta.mock.calls[espiaAlerta.mock.calls.length - 1][2] ?? [];
    await botoes.find((botao) => botao.text === 'Escolher da galeria')?.onPress?.(undefined as never);
    await waitFor(() => expect(screen.getByLabelText('Foto 1 do atestado')).toBeTruthy());
    await fireEvent.press(screen.getByText('Enviar Atestado'));
  }

  await preencherEEnviar();
  await waitFor(() => expect(screen.getByText('Atestado enviado. O RH vai analisar.')).toBeTruthy());

  await preencherEEnviar();
  await waitFor(() => expect(screen.getByText('Não foi possível enviar. Tente de novo.')).toBeTruthy());
  expect(screen.queryByText('Atestado enviado. O RH vai analisar.')).toBeNull();
});
