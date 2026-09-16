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

  render(<Atestados />);

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
  expect(screen.getByText('APROVADO')).toBeTruthy();
  expect(screen.getByText('REJEITADO')).toBeTruthy();
  expect(screen.getByText('Foto ilegível')).toBeTruthy();
});

test('sem atestados mostra o estado vazio', async () => {
  render(<Atestados />);

  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());
});

test('falha ao carregar mostra erro e permite tentar de novo', async () => {
  listarMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([atestadoFake()]);

  render(<Atestados />);
  await waitFor(() =>
    expect(screen.getByText('Não foi possível carregar seus atestados')).toBeTruthy(),
  );

  await fireEvent.press(screen.getByText('Tentar de novo'));

  await waitFor(() => expect(screen.getByText('EM ANÁLISE')).toBeTruthy());
});

test('novo atestado: enviar fecha o formulário, avisa e recarrega a lista', async () => {
  enviarMock.mockResolvedValue(atestadoFake());
  listarMock.mockResolvedValueOnce([]).mockResolvedValueOnce([atestadoFake()]);

  render(<Atestados />);
  await waitFor(() => expect(screen.getByText('Nenhum atestado enviado ainda.')).toBeTruthy());

  await fireEvent.press(screen.getByText('Novo atestado'));
  expect(screen.getByText('Enviar atestado')).toBeTruthy();

  await fireEvent.press(screen.getByText('Cancelar'));

  expect(screen.queryByText('Enviar atestado')).toBeNull();
  expect(enviarMock).not.toHaveBeenCalled();
});
