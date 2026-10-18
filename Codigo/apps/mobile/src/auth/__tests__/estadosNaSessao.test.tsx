import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { createJSONStorage } from 'zustand/middleware';
import { ErroApi } from '../../http/erroApi';
import { CHAVE_SINCRONIZACAO, CHAVE_UI } from '../../estado/chavesPersistidas';
import { reiniciarSessaoStore, useSessaoStore } from '../../estado/sessaoStore';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { useUiStore } from '../../estado/uiStore';
import { armazenamentoEmMemoria } from '../../estado/__tests__/apoio';
import { ProvedorAuth, useAuth } from '../AuthContext';
import * as armazenamento from '../armazenamentoSessao';
import * as database from '../../db/database';
import { comTokenRenovado, definirTokens } from '../tokenSessao';
import { gestor, montador, respostaJson, sessaoDe } from './apoio';

// Sessão × stores Zustand: o que a sessão guarda em memória (`useSessaoStore`) e o
// que acontece com os stores persistidos (obra, rascunho, status) em cada evento.

jest.mock('../armazenamentoSessao');
// Mesmo motivo de `AuthContext.test.tsx`: o singleton real do banco é um stub no Jest.
jest.mock('../../db/database');

const armazenamentoMock = jest.mocked(armazenamento);
const databaseMock = jest.mocked(database);

type Dono = { tipo: 'ausente' } | { tipo: 'dono'; usuarioId: number };
const OUTRO_ID = 101;
const SESSAO_SALVA = { accessToken: 'access', refreshToken: 'refresh', usuario: montador };

/** O "disco" dos stores persistidos (no app, o localStorage do banco). */
let disco: ReturnType<typeof armazenamentoEmMemoria>;

function Sonda() {
  const { sessao, restaurando, entrar, sair } = useAuth();
  return (
    <>
      <Text testID="restaurando">{String(restaurando)}</Text>
      <Text testID="usuario">{sessao?.usuario.nome ?? 'sem-sessao'}</Text>
      <Pressable
        testID="entrar"
        onPress={() => void entrar(montador.email, 'senha-correta').catch(() => undefined)}
      >
        <Text>Entrar</Text>
      </Pressable>
      <Pressable testID="sair" onPress={() => void sair()}>
        <Text>Sair</Text>
      </Pressable>
    </>
  );
}

async function renderizar() {
  await render(
    <ProvedorAuth>
      <Sonda />
    </ProvedorAuth>,
  );
  await waitFor(() => expect(screen.getByTestId('restaurando')).toHaveTextContent('false'));
}

function prepararFila({ acoes, banco }: { acoes: number; banco: Dono }) {
  databaseMock.contarAcoesNaFilaLocal.mockResolvedValue(acoes);
  databaseMock.lerDonoNoBancoLocal.mockResolvedValue(banco);
}

/** O montador deixou obra e rascunho gravados e fechou o app: o disco fica, a memória some. */
function deixarEstadosNoDiscoEFecharOApp() {
  useUiStore.getState().escolherObra(12);
  useUiStore.getState().alterarRascunhoAvaria({
    pedidoId: 12,
    campos: { pecaId: 5, tipoAvariaId: 2, descricao: 'Porta riscada' },
  });
  useUiStore.getState().anexarFotoAoRascunho('1-a.jpg');
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: 1_700_000_000_000 });
  const noDisco = new Map(disco.dados);
  useUiStore.getState().reiniciar();
  useSincronizacaoStore.getState().reiniciar();
  disco.dados.clear();
  noDisco.forEach((valor, chave) => disco.dados.set(chave, valor));
}

function preencherMemoria() {
  useUiStore.getState().escolherObra(12);
  useUiStore.getState().anexarFotoAoRascunho('1-a.jpg');
  useSincronizacaoStore.setState({ ultimaSincronizacaoEm: 1_700_000_000_000 });
}

const memoriaVazia = () => {
  expect(useUiStore.getState().obraEscolhidaId).toBeNull();
  expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual([]);
  expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).toBeNull();
};

beforeEach(() => {
  jest.clearAllMocks();
  definirTokens(null);
  reiniciarSessaoStore();
  disco = armazenamentoEmMemoria();
  const storage = createJSONStorage(() => disco.armazenamento);
  useUiStore.persist.setOptions({ storage });
  useSincronizacaoStore.persist.setOptions({ storage });
  useUiStore.getState().reiniciar();
  useSincronizacaoStore.getState().reiniciar();
  disco.dados.clear();

  armazenamentoMock.lerSessao.mockResolvedValue(null);
  armazenamentoMock.salvarSessao.mockResolvedValue(undefined);
  armazenamentoMock.limparSessao.mockResolvedValue(undefined);
  armazenamentoMock.lerDonoDaFila.mockResolvedValue({ tipo: 'ausente' });
  armazenamentoMock.registrarDonoDaFila.mockResolvedValue(true);
  armazenamentoMock.limparDonoDaFila.mockResolvedValue(undefined);
  databaseMock.contarAcoesNaFilaLocal.mockResolvedValue(0);
  databaseMock.lerDonoNoBancoLocal.mockResolvedValue({ tipo: 'ausente' });
  databaseMock.registrarDonoNoBancoLocal.mockResolvedValue(true);
  databaseMock.limparBancoLocal.mockResolvedValue(undefined);
  databaseMock.limparEspelhoBancoLocal.mockResolvedValue(undefined);
  globalThis.fetch = jest.fn();
});

describe('store de sessão', () => {
  test('o usuário e o fim da restauração vivem no store, em memória', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockReturnValue(new Promise(() => undefined));
    expect(useSessaoStore.getState()).toEqual({ usuario: null, restaurando: true });

    await renderizar();

    expect(useSessaoStore.getState()).toEqual({ usuario: montador, restaurando: false });
  });

  test('sem sessão guardada o boot termina com usuário nulo', async () => {
    await renderizar();

    expect(useSessaoStore.getState()).toEqual({ usuario: null, restaurando: false });
  });

  test('o usuário não é gravado em armazenamento sem criptografia (só o SecureStore guarda perfil)', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockResolvedValue(respostaJson(200, montador));

    await renderizar();
    await act(async () => {
      await Promise.resolve();
    });

    const tudoNoDisco = [...disco.dados.values()].join('');
    expect(tudoNoDisco).not.toContain(montador.nome);
    expect(tudoNoDisco).not.toContain(montador.email);
  });

  test('entrar publica o usuário; sair o zera', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));
    await renderizar();

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(useSessaoStore.getState().usuario).toEqual(montador));

    await fireEvent.press(screen.getByTestId('sair'));
    await waitFor(() => expect(useSessaoStore.getState().usuario).toBeNull());
  });
});

describe('reabrir o app (boot com sessão guardada do mesmo usuário)', () => {
  test('a obra, o rascunho e a última sincronização voltam ANTES de a sessão aparecer', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockReturnValue(new Promise(() => undefined));
    prepararFila({ acoes: 1, banco: { tipo: 'dono', usuarioId: montador.id } });
    deixarEstadosNoDiscoEFecharOApp();
    memoriaVazia();
    let estadoQuandoAAppAbriu: { obra: number | null; fotos: string[] } | null = null;
    const cancelar = useSessaoStore.subscribe((estado) => {
      if (estado.usuario && !estadoQuandoAAppAbriu) {
        estadoQuandoAAppAbriu = {
          obra: useUiStore.getState().obraEscolhidaId,
          fotos: useUiStore.getState().rascunhoAvaria.fotos,
        };
      }
    });

    await renderizar();
    cancelar();

    expect(estadoQuandoAAppAbriu).toEqual({ obra: 12, fotos: ['1-a.jpg'] });
    expect(useUiStore.getState().rascunhoAvaria.campos.descricao).toBe('Porta riscada');
    expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).toBe(1_700_000_000_000);
  });

  test('aparelho de OUTRO usuário (o wipe apaga a fila): nada do anterior é hidratado, nem em memória nem no disco', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockReturnValue(new Promise(() => undefined));
    prepararFila({ acoes: 1, banco: { tipo: 'dono', usuarioId: OUTRO_ID } });
    // O estado do usuário anterior continua na memória (expiração forçada) E no disco.
    deixarEstadosNoDiscoEFecharOApp();
    preencherMemoria();

    await renderizar();

    expect(databaseMock.limparBancoLocal).toHaveBeenCalledTimes(1);
    memoriaVazia();
    expect(disco.dados.has(CHAVE_UI)).toBe(false);
    expect(disco.dados.has(CHAVE_SINCRONIZACAO)).toBe(false);
  });

  test('perfil não-MONTADOR guardado: descarta os estados e não hidrata nada', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue({ ...SESSAO_SALVA, usuario: gestor });
    deixarEstadosNoDiscoEFecharOApp();

    await renderizar();

    memoriaVazia();
    expect(disco.dados.has(CHAVE_UI)).toBe(false);
  });
});

describe('entrar()', () => {
  async function entrar() {
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(respostaJson(200, sessaoDe(montador)));
    await renderizar();
    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(useSessaoStore.getState().usuario).toEqual(montador));
  }

  test('outro usuário no aparelho: a obra e o rascunho do anterior não aparecem para quem entra', async () => {
    prepararFila({ acoes: 2, banco: { tipo: 'dono', usuarioId: OUTRO_ID } });
    deixarEstadosNoDiscoEFecharOApp();
    preencherMemoria();

    await entrar();

    memoriaVazia();
    expect(disco.dados.has(CHAVE_UI)).toBe(false);
  });

  test('mesmo usuário voltando depois de uma expiração forçada reencontra a obra e o rascunho', async () => {
    prepararFila({ acoes: 1, banco: { tipo: 'dono', usuarioId: montador.id } });
    deixarEstadosNoDiscoEFecharOApp();

    await entrar();

    expect(databaseMock.limparBancoLocal).not.toHaveBeenCalled();
    expect(useUiStore.getState().obraEscolhidaId).toBe(12);
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual(['1-a.jpg']);
  });
});

describe('sair() — logout explícito', () => {
  async function entrarESair() {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest.mocked(globalThis.fetch).mockResolvedValue(respostaJson(200, montador));
    await renderizar();
    await act(async () => {
      await Promise.resolve();
    });
    preencherMemoria();
    useUiStore.getState().alterarRascunhoAvaria({ campos: { descricao: 'rascunho' } });
    expect(disco.dados.has(CHAVE_UI)).toBe(true);

    await fireEvent.press(screen.getByTestId('sair'));
    await waitFor(() => expect(useSessaoStore.getState().usuario).toBeNull());
  }

  test('zera os stores em memória e apaga as chaves do disco', async () => {
    await entrarESair();

    memoriaVazia();
    expect(useUiStore.getState().rascunhoAvaria.campos.descricao).toBe('');
    await waitFor(() => expect(disco.dados.has(CHAVE_UI)).toBe(false));
    expect(disco.dados.has(CHAVE_SINCRONIZACAO)).toBe(false);
  });

  test('mesmo se o banco não deixar apagar, o estado do usuário some da memória e do disco', async () => {
    databaseMock.limparBancoLocal.mockRejectedValue(new Error('banco indisponível'));

    await entrarESair();

    memoriaVazia();
    await waitFor(() => expect(disco.dados.has(CHAVE_UI)).toBe(false));
  });

  test('o login seguinte (outro montador) não recebe nada do anterior', async () => {
    await entrarESair();
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(respostaJson(200, sessaoDe({ ...montador, id: OUTRO_ID, nome: 'Outro' })));

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(useSessaoStore.getState().usuario?.id).toBe(OUTRO_ID));

    memoriaVazia();
  });
});

describe('expiração forçada da sessão (a fila e o dono ficam)', () => {
  test('descarta o status da sincronização e MANTÉM obra e rascunho do mesmo montador', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(200, montador))
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' }));
    await renderizar();
    await act(async () => {
      await Promise.resolve();
    });
    preencherMemoria();

    await act(async () => {
      await comTokenRenovado(() =>
        Promise.reject(new ErroApi('TOKEN_EXPIRADO', 'expirado', 401)),
      ).catch(() => undefined);
    });
    await waitFor(() => expect(useSessaoStore.getState().usuario).toBeNull());

    expect(databaseMock.limparEspelhoBancoLocal).toHaveBeenCalled();
    expect(useSincronizacaoStore.getState().ultimaSincronizacaoEm).toBeNull();
    await waitFor(() => expect(disco.dados.has(CHAVE_SINCRONIZACAO)).toBe(false));
    expect(useUiStore.getState().obraEscolhidaId).toBe(12);
    expect(useUiStore.getState().rascunhoAvaria.fotos).toEqual(['1-a.jpg']);
    expect(disco.dados.has(CHAVE_UI)).toBe(true);
  });

  test('sem conseguir marcar o dono, apaga tudo — estados do usuário inclusive', async () => {
    armazenamentoMock.lerSessao.mockResolvedValue(SESSAO_SALVA);
    armazenamentoMock.registrarDonoDaFila.mockResolvedValue(false);
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaJson(200, montador))
      .mockResolvedValueOnce(respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' }));
    await renderizar();
    await act(async () => {
      await Promise.resolve();
    });
    preencherMemoria();

    await act(async () => {
      await comTokenRenovado(() =>
        Promise.reject(new ErroApi('TOKEN_EXPIRADO', 'expirado', 401)),
      ).catch(() => undefined);
    });
    await waitFor(() => expect(useSessaoStore.getState().usuario).toBeNull());

    expect(databaseMock.limparBancoLocal).toHaveBeenCalled();
    memoriaVazia();
  });
});
