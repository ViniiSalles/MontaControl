import { localStorageKey } from '@nozbe/watermelondb';
import {
  guardarObras,
  lembrarObraDaJornada,
  lerObraDaJornada,
  lerObras,
} from '../../pedidos/obrasLocais';
import { AcaoPendente } from '../AcaoPendente';
import { BancoHoras } from '../BancoHoras';
import { Jornada } from '../Jornada';
import { limparEspelhoLocal } from '../limparEspelho';
import { criarBancoDeTeste } from './apoio';

// Expiração forçada da sessão (refresh recusado): a réplica do servidor some, mas
// a fila de ações (ainda não enviadas) fica — são marcações do montador.
describe('limparEspelhoLocal', () => {
  it('apaga a réplica (jornadas, banco de horas, cópia de obras) e preserva as ações pendentes', async () => {
    const database = criarBancoDeTeste();
    await database.write(async () => {
      await database.get<Jornada>('jornadas').create((registro) => {
        registro.remoteId = 1;
        registro.usuarioId = 3;
        registro.status = 'EM_ANDAMENTO';
        registro.lancadoEmAtraso = false;
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
      });
      await database.get<BancoHoras>('banco_horas').create((registro) => {
        registro.mes = 9;
        registro.ano = 2026;
        registro.horasTrabalhadas = 10;
        registro.horasPrevistas = 176;
        registro.saldo = -166;
      });
      await database.get<AcaoPendente>('acoes_pendentes').create((registro) => {
        registro.tipo = 'checkin';
        registro.idCliente = 'id-1';
        registro.payload = '{}';
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.status = 'pendente';
        registro.mensagemDescarte = null;
      });
    });
    await guardarObras(database, [
      { id: 10, numeroPedido: 'P-10', cliente: { latitude: -19.9, longitude: -43.9 } } as never,
    ]);
    await lembrarObraDaJornada(database, 10);

    await limparEspelhoLocal(database);

    expect(await database.get('jornadas').query().fetchCount()).toBe(0);
    expect(await database.get('banco_horas').query().fetchCount()).toBe(0);
    expect(await lerObras(database)).toEqual([]);
    expect(await lerObraDaJornada(database)).toBeNull();
    const pendentes = await database.get<AcaoPendente>('acoes_pendentes').query().fetch();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].idCliente).toBe('id-1');
  });

  it('não mexe em chaves de localStorage que não são da réplica', async () => {
    const database = criarBancoDeTeste();
    const chave = localStorageKey<string>('outra_chave');
    await database.localStorage.set(chave, 'valor');

    await limparEspelhoLocal(database);

    expect(await database.localStorage.get(chave)).toBe('valor');
  });
});
