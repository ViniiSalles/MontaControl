import { Q } from '@nozbe/watermelondb';
import { File, Paths } from 'expo-file-system';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { StatusJornada } from '@montacontrol/shared';
import type { JornadaDTO } from '@montacontrol/shared';
import { criarAcaoPendente, criarBancoDeTeste } from '../../db/__tests__/apoio';
import { AcaoPendente } from '../../db/AcaoPendente';
import { Jornada } from '../../db/Jornada';
import { lerDonoNoBanco, registrarDonoNoBanco } from '../../db/donoDaFila';
import { apagarTodasAsFotos, salvarFoto } from '../../fotos/armazenamentoFotos';
import { existeFoto } from '../../fotos/__tests__/apoio';
import { drenarFila } from '../../sincronizacao/syncManager';
import { reiniciarSessaoStore } from '../../estado/sessaoStore';
import { ProvedorAuth, useAuth } from '../AuthContext';
import { definirTokens } from '../tokenSessao';
import { montador, respostaJson, sessaoDe } from './apoio';

// Ponta a ponta da expiração forçada da sessão: AuthContext, token, SecureStore
// (em memória), banco local (Loki) e clientes HTTP reais. Só `fetch` é falso.

const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (chave: string) => mockSecureStore.get(chave) ?? null),
  setItemAsync: jest.fn(async (chave: string, valor: string) => {
    mockSecureStore.set(chave, valor);
  }),
  deleteItemAsync: jest.fn(async (chave: string) => {
    mockSecureStore.delete(chave);
  }),
}));

let mockBanco: ReturnType<typeof criarBancoDeTeste>;
jest.mock('../../db/database', () => ({
  limparBancoLocal: jest.fn(() =>
    jest
      .requireActual<typeof import('../../db/limparBanco')>('../../db/limparBanco')
      .limparBancoCompleto(mockBanco),
  ),
  // `require` lazy: a fábrica do mock não pode referenciar imports do arquivo.
  limparEspelhoBancoLocal: jest.fn(() =>
    jest
      .requireActual<typeof import('../../db/limparEspelho')>('../../db/limparEspelho')
      .limparEspelhoLocal(mockBanco),
  ),
  contarAcoesNaFilaLocal: jest.fn(() =>
    jest
      .requireActual<typeof import('../../db/donoDaFila')>('../../db/donoDaFila')
      .contarAcoesNaFila(mockBanco),
  ),
  lerDonoNoBancoLocal: jest.fn(() =>
    jest
      .requireActual<typeof import('../../db/donoDaFila')>('../../db/donoDaFila')
      .lerDonoNoBanco(mockBanco),
  ),
  registrarDonoNoBancoLocal: jest.fn((usuarioId: number) =>
    jest
      .requireActual<typeof import('../../db/donoDaFila')>('../../db/donoDaFila')
      .registrarDonoNoBanco(mockBanco, usuarioId),
  ),
}));

const CHAVE_SESSAO = 'mc.sessao.v2';
const CHAVE_DONO = 'mc.fila.dono.v1';
const OUTRO_MONTADOR = { ...montador, id: 2, nome: 'Outro Montador' };

const JORNADA_SERVIDOR: JornadaDTO = {
  id: 7,
  usuarioId: montador.id,
  status: StatusJornada.EM_ANDAMENTO,
  checkinAt: '2026-09-09T12:00:00.000Z',
  checkinLatitude: -19.9,
  checkinLongitude: -43.9,
  checkinEndereco: null,
  checkoutAt: null,
  checkoutLatitude: null,
  checkoutLongitude: null,
  checkoutEndereco: null,
  lancadoEmAtraso: false,
  criadoEm: '2026-09-09T12:00:00.000Z',
};

let respostaDoLogin: Response;
let chamadasAoCheckin: { authorization: string }[];

function Sonda() {
  const { sessao, restaurando, entrar, sair } = useAuth();
  return (
    <>
      <Text testID="restaurando">{String(restaurando)}</Text>
      <Text testID="usuario">{sessao?.usuario.nome ?? 'sem-sessao'}</Text>
      <Pressable
        testID="entrar"
        onPress={() => void entrar('a@b.c', 'senha').catch(() => undefined)}
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

/** Banco como um login real deixa: a ação na fila e o dono gravado ao lado dela (`donoId`; `null` = fila antiga, sem dono). */
async function popularBanco(donoId: number | null = montador.id) {
  if (donoId !== null) await registrarDonoNoBanco(mockBanco, donoId);
  await mockBanco.write(async () => {
    await mockBanco.get<Jornada>('jornadas').create((registro) => {
      registro.usuarioId = montador.id;
      registro.status = StatusJornada.EM_ANDAMENTO;
      registro.lancadoEmAtraso = false;
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
    });
    await mockBanco.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = 'id-1';
      registro.payload = JSON.stringify({
        idCliente: 'id-1',
        latitude: -19.9,
        longitude: -43.9,
        registradoEm: '2026-09-09T12:00:00.000Z',
      });
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'pendente';
      registro.mensagemDescarte = null;
    });
  });
}

const contarAcoes = () => mockBanco.get('acoes_pendentes').query().fetchCount();
// Check-in aceito vira `enviada` (aguarda o pull); só `pendente` ainda precisa subir.
const contarPendentes = () =>
  mockBanco.get('acoes_pendentes').query(Q.where('status', 'pendente')).fetchCount();
const contarJornadas = () => mockBanco.get('jornadas').query().fetchCount();

/** Sessão guardada do montador com refresh token que o servidor já não aceita. */
function guardarSessaoExpirada() {
  mockSecureStore.set(
    CHAVE_SESSAO,
    JSON.stringify({ accessToken: 'velho', refreshToken: 'morto', usuario: montador }),
  );
}

function rotear() {
  jest.mocked(globalThis.fetch).mockImplementation(async (url, init) => {
    const caminho = String(url);
    if (caminho.includes('/api/auth/me')) {
      return respostaJson(401, { codigo: 'TOKEN_EXPIRADO', message: 'expirado' });
    }
    if (caminho.includes('/api/auth/refresh')) {
      return respostaJson(401, { codigo: 'TOKEN_INVALIDO', message: 'invalido' });
    }
    if (caminho.includes('/api/auth/login')) return respostaDoLogin;
    if (caminho.includes('/api/jornadas/checkin')) {
      chamadasAoCheckin.push({
        authorization: (init?.headers as Record<string, string>).Authorization,
      });
      return respostaJson(201, JORNADA_SERVIDOR);
    }
    return respostaJson(204, null);
  });
}

/** Boot com sessão guardada e refresh recusado: expiração forçada com uma ação na fila. */
async function expirarSessaoComAcaoNaFila() {
  guardarSessaoExpirada();
  await popularBanco();
  await renderizar();
  await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
  await waitFor(() => expect(mockSecureStore.has(CHAVE_DONO)).toBe(true));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStore.clear();
  mockBanco = criarBancoDeTeste();
  definirTokens(null);
  // O store de sessão é global (como no app): sem isto o usuário de um teste vaza para o seguinte.
  reiniciarSessaoStore();
  chamadasAoCheckin = [];
  respostaDoLogin = respostaJson(200, sessaoDe(montador, '-2'));
  globalThis.fetch = jest.fn();
  rotear();
});

describe('expiração forçada da sessão (refresh recusado)', () => {
  test('mantém a fila, limpa a réplica e registra o dono da fila', async () => {
    await expirarSessaoComAcaoNaFila();

    expect(await contarAcoes()).toBe(1);
    expect(await contarJornadas()).toBe(0);
    expect(JSON.parse(mockSecureStore.get(CHAVE_DONO)!)).toEqual({ usuarioId: montador.id });
    expect(mockSecureStore.has(CHAVE_SESSAO)).toBe(false);
    // O dono guardado ao lado da fila sobrevive junto com ela.
    expect(await lerDonoNoBanco(mockBanco)).toEqual({ tipo: 'dono', usuarioId: montador.id });
  });

  test('mesmo usuário com o dono só no banco (marcador do SecureStore perdido): a fila é mantida e enviada', async () => {
    await expirarSessaoComAcaoNaFila();
    mockSecureStore.delete(CHAVE_DONO);

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome));
    await drenarFila(mockBanco);

    expect(chamadasAoCheckin).toEqual([{ authorization: 'Bearer access-2' }]);
    expect(await contarPendentes()).toBe(0);
  });

  test('fila sem nenhum dono conhecido (anterior à atualização): apagada no login, nada é enviado', async () => {
    await expirarSessaoComAcaoNaFila();
    await mockBanco.write(() => mockBanco.localStorage.remove('dono_da_fila'));
    mockSecureStore.delete(CHAVE_DONO);

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome));
    await drenarFila(mockBanco);

    expect(await contarAcoes()).toBe(0);
    expect(chamadasAoCheckin).toEqual([]);
  });

  test('marcador velho de outro usuário no SecureStore não faz o boot apagar a fila do próprio dono', async () => {
    mockSecureStore.set(CHAVE_DONO, JSON.stringify({ usuarioId: OUTRO_MONTADOR.id }));
    mockSecureStore.set(
      CHAVE_SESSAO,
      JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', usuario: montador }),
    );
    jest.mocked(globalThis.fetch).mockResolvedValue(respostaJson(200, montador));
    await popularBanco(montador.id);

    await renderizar();

    expect(await contarAcoes()).toBe(1);
    expect(mockSecureStore.has(CHAVE_DONO)).toBe(false);
  });

  test('novo login do MESMO usuário: a fila é mantida, o marcador some e a ação sobe com o token novo', async () => {
    await expirarSessaoComAcaoNaFila();

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome));

    expect(await contarAcoes()).toBe(1);
    expect(mockSecureStore.has(CHAVE_DONO)).toBe(false);
    expect(await lerDonoNoBanco(mockBanco)).toEqual({ tipo: 'dono', usuarioId: montador.id });

    await drenarFila(mockBanco);

    expect(chamadasAoCheckin).toEqual([{ authorization: 'Bearer access-2' }]);
    expect(await contarPendentes()).toBe(0);
  });

  test('login de OUTRO usuário: apaga tudo e nenhuma ação é enviada sob o token dele', async () => {
    await expirarSessaoComAcaoNaFila();
    respostaDoLogin = respostaJson(200, sessaoDe(OUTRO_MONTADOR, '-b'));

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() =>
      expect(screen.getByTestId('usuario')).toHaveTextContent(OUTRO_MONTADOR.nome),
    );

    expect(await contarAcoes()).toBe(0);
    expect(await contarJornadas()).toBe(0);
    expect(mockSecureStore.has(CHAVE_DONO)).toBe(false);
    // Invariante: depois de autenticar, o dono do banco é quem autenticou.
    expect(await lerDonoNoBanco(mockBanco)).toEqual({ tipo: 'dono', usuarioId: OUTRO_MONTADOR.id });

    await drenarFila(mockBanco);

    expect(chamadasAoCheckin).toEqual([]);
  });
});

describe('réplica de outro usuário com a fila vazia', () => {
  test('o wipe do logout falhou e deixou a réplica: outro usuário que entra com a fila vazia a encontra apagada', async () => {
    // Estado que o logout deixaria se o wipe tivesse falhado: réplica do usuário 1, dono 1, fila vazia.
    await registrarDonoNoBanco(mockBanco, montador.id);
    await popularBanco(montador.id);
    await mockBanco.write(async () => {
      for (const acao of await mockBanco.get('acoes_pendentes').query().fetch()) {
        await acao.destroyPermanently();
      }
    });
    respostaDoLogin = respostaJson(200, sessaoDe(OUTRO_MONTADOR, '-b'));
    await renderizar();

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() =>
      expect(screen.getByTestId('usuario')).toHaveTextContent(OUTRO_MONTADOR.nome),
    );

    expect(await contarJornadas()).toBe(0);
    expect(await lerDonoNoBanco(mockBanco)).toEqual({ tipo: 'dono', usuarioId: OUTRO_MONTADOR.id });
  });
});

describe('logout explícito', () => {
  test('apaga a fila, a réplica, a sessão e o marcador de dono', async () => {
    mockSecureStore.set(
      CHAVE_SESSAO,
      JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', usuario: montador }),
    );
    mockSecureStore.set(CHAVE_DONO, JSON.stringify({ usuarioId: montador.id }));
    jest.mocked(globalThis.fetch).mockResolvedValue(respostaJson(200, montador));
    await popularBanco();
    await renderizar();
    // Marcador de uma expiração anterior do mesmo usuário é consumido no boot; recoloca para o logout provar a limpeza.
    mockSecureStore.set(CHAVE_DONO, JSON.stringify({ usuarioId: montador.id }));

    await fireEvent.press(screen.getByTestId('sair'));

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    await waitFor(() => expect(mockSecureStore.has(CHAVE_DONO)).toBe(false));
    expect(await contarAcoes()).toBe(0);
    expect(await contarJornadas()).toBe(0);
    expect(mockSecureStore.has(CHAVE_SESSAO)).toBe(false);
    // O dono guardado ao lado da fila morre junto com o banco.
    expect(await lerDonoNoBanco(mockBanco)).toEqual({ tipo: 'ausente' });
  });
});

describe('fotos de atestado e avaria guardadas no aparelho (#113)', () => {
  /** Uma ação da fila com foto em arquivo, além do check-in do `popularBanco`. */
  async function popularComFoto(): Promise<string> {
    await popularBanco();
    const origem = new File(Paths.cache, `picker-${Math.random()}.jpg`);
    origem.create({ intermediates: true });
    origem.write('atestado');
    const caminho = await salvarFoto(origem.uri, 'image/jpeg');
    await criarAcaoPendente(mockBanco, {
      tipo: 'atestado',
      idCliente: 'atestado-1',
      payload: { fotosCaminhos: [caminho] },
    });
    return caminho;
  }

  afterEach(async () => {
    await apagarTodasAsFotos();
  });

  test('expiração forçada mantém a fila e, com ela, as fotos', async () => {
    guardarSessaoExpirada();
    const caminho = await popularComFoto();
    await renderizar();
    await waitFor(() => expect(mockSecureStore.has(CHAVE_DONO)).toBe(true));

    expect(await contarAcoes()).toBe(2);
    expect(existeFoto(caminho)).toBe(true);
  });

  test('login do MESMO usuário depois da expiração mantém as fotos', async () => {
    guardarSessaoExpirada();
    const caminho = await popularComFoto();
    await renderizar();
    await waitFor(() => expect(mockSecureStore.has(CHAVE_DONO)).toBe(true));

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent(montador.nome));

    expect(existeFoto(caminho)).toBe(true);
  });

  test('login de OUTRO usuário apaga a fila e as fotos do anterior', async () => {
    guardarSessaoExpirada();
    const caminho = await popularComFoto();
    await renderizar();
    await waitFor(() => expect(mockSecureStore.has(CHAVE_DONO)).toBe(true));
    respostaDoLogin = respostaJson(200, sessaoDe(OUTRO_MONTADOR, '-b'));

    await fireEvent.press(screen.getByTestId('entrar'));
    await waitFor(() =>
      expect(screen.getByTestId('usuario')).toHaveTextContent(OUTRO_MONTADOR.nome),
    );

    expect(await contarAcoes()).toBe(0);
    expect(existeFoto(caminho)).toBe(false);
  });

  test('logout explícito apaga as fotos', async () => {
    mockSecureStore.set(
      CHAVE_SESSAO,
      JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', usuario: montador }),
    );
    jest.mocked(globalThis.fetch).mockResolvedValue(respostaJson(200, montador));
    const caminho = await popularComFoto();
    await renderizar();

    await fireEvent.press(screen.getByTestId('sair'));

    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('sem-sessao'));
    await waitFor(() => expect(existeFoto(caminho)).toBe(false));
  });
});
