import { localStorageKey } from '@nozbe/watermelondb';
import { AcaoPendente } from '../AcaoPendente';
import { contarAcoesNaFila, lerDonoNoBanco, registrarDonoNoBanco } from '../donoDaFila';
import { limparEspelhoLocal } from '../limparEspelho';
import { criarBancoDeTeste } from './apoio';

async function criarAcao(database: ReturnType<typeof criarBancoDeTeste>, status = 'pendente') {
  await database.write(() =>
    database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
      registro.tipo = 'checkin';
      registro.idCliente = `id-${Math.random()}`;
      registro.payload = '{}';
      registro.criadoEm = '2026-09-09T12:00:00.000Z';
      registro.status = status;
      registro.mensagemDescarte = null;
    }),
  );
}

describe('dono da fila no banco local', () => {
  it('sem registro, a leitura é "ausente"', async () => {
    const database = criarBancoDeTeste();

    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'ausente' });
  });

  it('registra e lê o id do dono', async () => {
    const database = criarBancoDeTeste();

    expect(await registrarDonoNoBanco(database, 7)).toBe(true);

    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'dono', usuarioId: 7 });
  });

  it('valor ilegível (não é um id) ou erro de leitura é "erro", nunca "ausente"', async () => {
    const database = criarBancoDeTeste();
    await database.localStorage.set(localStorageKey<string>('dono_da_fila'), 'lixo');
    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'erro' });

    jest.spyOn(database.localStorage, 'get').mockRejectedValueOnce(new Error('banco indisponível'));
    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'erro' });
  });

  it('falha ao gravar devolve false, sem lançar', async () => {
    const database = criarBancoDeTeste();
    jest.spyOn(database.localStorage, 'set').mockRejectedValueOnce(new Error('banco indisponível'));

    expect(await registrarDonoNoBanco(database, 7)).toBe(false);
  });

  it('o dono sobrevive à limpeza da réplica (expiração forçada) mas morre no wipe completo (logout)', async () => {
    const database = criarBancoDeTeste();
    await registrarDonoNoBanco(database, 7);

    await limparEspelhoLocal(database);
    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'dono', usuarioId: 7 });

    await database.write(() => database.unsafeResetDatabase());
    expect(await lerDonoNoBanco(database)).toEqual({ tipo: 'ausente' });
  });
});

describe('contarAcoesNaFila', () => {
  it('conta toda ação na fila, de qualquer status', async () => {
    const database = criarBancoDeTeste();
    expect(await contarAcoesNaFila(database)).toBe(0);

    await criarAcao(database, 'pendente');
    await criarAcao(database, 'descartada');

    expect(await contarAcoesNaFila(database)).toBe(2);
  });
});
