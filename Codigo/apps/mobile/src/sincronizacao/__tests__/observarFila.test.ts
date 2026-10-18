import { waitFor } from '@testing-library/react-native';
import { Q } from '@nozbe/watermelondb';
import { File, Paths } from 'expo-file-system';
import { AcaoPendente } from '../../db/AcaoPendente';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { useSincronizacaoStore } from '../../estado/sincronizacaoStore';
import { apagarTodasAsFotos, salvarFoto } from '../../fotos/armazenamentoFotos';
import { existeFoto } from '../../fotos/__tests__/apoio';
import { observarFila } from '../observarFila';

let database = criarBancoDeTeste();
let parar: (() => void) | null = null;

const estado = () => useSincronizacaoStore.getState();

function iniciar() {
  parar = observarFila(database);
}

/**
 * Intercepta só o `batch` que apaga ações (o da observação); criar linhas segue
 * usando o `batch` real. `resultado` decide o que o apagamento devolve.
 */
function interceptarApagamento(resultado: () => Promise<void>) {
  const original = database.batch.bind(database) as (...args: unknown[]) => Promise<void>;
  jest
    .spyOn(database, 'batch')
    .mockImplementation(((...args: unknown[]) =>
      args.some(
        (registro) =>
          (registro as { _preparedState?: string })?._preparedState === 'destroyPermanently',
      )
        ? resultado()
        : original(...args)) as never);
}

function criarAcao(status: 'pendente' | 'descartada', mensagemDescarte: string | null = null) {
  return database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'avaria';
      registro.idCliente = `id-${Math.random()}`;
      registro.payload = '{}';
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = status;
      registro.mensagemDescarte = mensagemDescarte;
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  database = criarBancoDeTeste();
  useSincronizacaoStore.getState().reiniciar();
});

afterEach(() => {
  parar?.();
  parar = null;
});

test('publica a contagem de ações pendentes e acompanha a fila', async () => {
  iniciar();
  await waitFor(() => expect(estado().pendentes).toBe(0));

  await criarAcao('pendente');
  await criarAcao('pendente');
  await waitFor(() => expect(estado().pendentes).toBe(2));

  const [primeira] = await database
    .get<AcaoPendente>('acoes_pendentes')
    .query(Q.where('status', 'pendente'))
    .fetch();
  await database.write(() => primeira.destroyPermanently());
  await waitFor(() => expect(estado().pendentes).toBe(1));
});

test('só ações pendentes contam: enviada e descartada não aparecem como pendência', async () => {
  iniciar();

  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = 'ja-enviada';
      registro.payload = '{}';
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'enviada';
      registro.mensagemDescarte = null;
    }),
  );
  await criarAcao('pendente');

  await waitFor(() => expect(estado().pendentes).toBe(1));
});

test('ação descartada vira aviso e sai da fila', async () => {
  iniciar();
  expect(estado().avisosDescartados).toEqual([]);

  await criarAcao('descartada', 'Ação recusada: JORNADA_EM_ANDAMENTO.');

  await waitFor(() =>
    expect(estado().avisosDescartados).toEqual(['Ação recusada: JORNADA_EM_ANDAMENTO.']),
  );
  await waitFor(async () =>
    expect(await database.get<AcaoPendente>('acoes_pendentes').query().fetchCount()).toBe(0),
  );
});

test('recusas em momentos diferentes se acumulam, sem perder a anterior', async () => {
  iniciar();

  await criarAcao('descartada', 'Avaria recusada: A.');
  await waitFor(() => expect(estado().avisosDescartados).toEqual(['Avaria recusada: A.']));

  await criarAcao('descartada', 'Check-out recusado: B.');
  await waitFor(() =>
    expect(estado().avisosDescartados).toEqual(['Avaria recusada: A.', 'Check-out recusado: B.']),
  );
});

test('o mesmo registro reemitido pelo observe não duplica o aviso', async () => {
  // Sem o destroy a linha A continua na tabela e volta a ser emitida junto com B.
  interceptarApagamento(() => Promise.resolve());
  iniciar();

  await criarAcao('descartada', 'Avaria recusada: A.');
  await waitFor(() => expect(estado().avisosDescartados).toHaveLength(1));
  await criarAcao('descartada', 'Check-out recusado: B.');

  await waitFor(() => expect(estado().avisosDescartados).toHaveLength(2));
  expect(estado().avisosDescartados).toEqual(['Avaria recusada: A.', 'Check-out recusado: B.']);
});

test('falha ao apagar a ação descartada não vira rejeição não tratada', async () => {
  interceptarApagamento(() => Promise.reject(new Error('falha de disco')));
  const naoTratada = jest.fn();
  process.on('unhandledRejection', naoTratada);
  iniciar();

  await criarAcao('descartada', 'Ação recusada: X.');
  await waitFor(() => expect(estado().avisosDescartados).toHaveLength(1));
  await new Promise<void>((resolver) => setTimeout(resolver, 20));

  process.off('unhandledRejection', naoTratada);
  expect(naoTratada).not.toHaveBeenCalled();
});

test('dispensarAvisos limpa os avisos já mostrados', async () => {
  iniciar();
  await criarAcao('descartada', 'Ação recusada: X.');
  await waitFor(() => expect(estado().avisosDescartados).toHaveLength(1));

  estado().dispensarAvisos();

  expect(estado().avisosDescartados).toEqual([]);
});

test('ao parar, deixa de acompanhar a fila e zera o que tinha publicado', async () => {
  iniciar();
  await criarAcao('pendente');
  await waitFor(() => expect(estado().pendentes).toBe(1));

  parar?.();
  parar = null;
  expect(estado().pendentes).toBe(0);

  await criarAcao('pendente');
  await new Promise<void>((resolver) => setTimeout(resolver, 20));
  expect(estado().pendentes).toBe(0);
});

test('ao apagar a ação descartada apaga também as fotos dela que ainda estejam no aparelho', async () => {
  const origem = new File(Paths.cache, 'picker-descartada.jpg');
  origem.create({ intermediates: true, overwrite: true });
  origem.write('foto');
  const caminho = await salvarFoto(origem.uri, 'image/jpeg');
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'atestado';
      registro.idCliente = 'atestado-descartado';
      registro.payload = JSON.stringify({ fotosCaminhos: [caminho] });
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = 'descartada';
      registro.mensagemDescarte = 'Ação recusada: X.';
    }),
  );

  iniciar();

  await waitFor(() => expect(existeFoto(caminho)).toBe(false));
  await apagarTodasAsFotos();
});
