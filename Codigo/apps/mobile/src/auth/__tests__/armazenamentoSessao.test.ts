import * as SecureStore from 'expo-secure-store';
import { lerSessao, limparSessao, salvarSessao } from '../armazenamentoSessao';
import { montador } from './apoio';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const secureStore = jest.mocked(SecureStore);

const SESSAO = { accessToken: 'access', refreshToken: 'refresh', usuario: montador };

beforeEach(() => {
  jest.clearAllMocks();
  secureStore.getItemAsync.mockResolvedValue(null);
  secureStore.setItemAsync.mockResolvedValue(undefined);
  secureStore.deleteItemAsync.mockResolvedValue(undefined);
});

describe('armazenamentoSessao', () => {
  test('guarda tokens e usuário juntos na chave versionada v2', async () => {
    await salvarSessao(SESSAO);

    expect(secureStore.setItemAsync).toHaveBeenCalledWith('mc.sessao.v2', JSON.stringify(SESSAO));
  });

  test('lê de volta a sessão guardada, com o usuário em cache', async () => {
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify(SESSAO));

    await expect(lerSessao()).resolves.toEqual(SESSAO);
    expect(secureStore.getItemAsync).toHaveBeenCalledWith('mc.sessao.v2');
  });

  test('sem nada guardado devolve null', async () => {
    await expect(lerSessao()).resolves.toBeNull();
  });

  test('sessão sem usuário (formato incompleto) vale como sem sessão', async () => {
    secureStore.getItemAsync.mockResolvedValue(
      JSON.stringify({ accessToken: 'access', refreshToken: 'refresh' }),
    );

    await expect(lerSessao()).resolves.toBeNull();
  });

  test('JSON corrompido ou SecureStore indisponível valem como sem sessão', async () => {
    secureStore.getItemAsync.mockResolvedValue('{quebrado');
    await expect(lerSessao()).resolves.toBeNull();

    secureStore.getItemAsync.mockRejectedValue(new Error('keystore indisponível'));
    await expect(lerSessao()).resolves.toBeNull();
  });

  test('limpar apaga a chave v2 e também a v1 legada (que só tinha tokens)', async () => {
    await limparSessao();

    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('mc.sessao.v2');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('mc.sessao.v1');
  });

  test('falha ao gravar ou limpar não derruba o app', async () => {
    secureStore.setItemAsync.mockRejectedValue(new Error('sem keystore'));
    secureStore.deleteItemAsync.mockRejectedValue(new Error('sem keystore'));

    await expect(salvarSessao(SESSAO)).resolves.toBeUndefined();
    await expect(limparSessao()).resolves.toBeUndefined();
  });
});
