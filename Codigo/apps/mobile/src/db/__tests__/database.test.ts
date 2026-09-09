import { Q } from '@nozbe/watermelondb';
import { criarBancoDeTeste } from './apoio';
import { Jornada } from '../Jornada';
import { BancoHoras } from '../BancoHoras';
import { AcaoPendente } from '../AcaoPendente';

describe('banco local', () => {
  it('grava e lê um registro de cada tabela', async () => {
    const database = criarBancoDeTeste();

    await database.write(async () => {
      await database.get<Jornada>('jornadas').create((registro) => {
        registro.remoteId = 1;
        registro.usuarioId = 3;
        registro.status = 'EM_ANDAMENTO';
        registro.checkinAt = '2026-09-09T12:00:00.000Z';
        registro.checkinLatitude = -19.9;
        registro.checkinLongitude = -43.9;
        registro.checkinEndereco = 'Rua Falsa, 123';
        registro.checkoutAt = null;
        registro.checkoutLatitude = null;
        registro.checkoutLongitude = null;
        registro.checkoutEndereco = null;
        registro.lancadoEmAtraso = false;
        registro.criadoEm = '2026-09-09T12:00:00.000Z';
        registro.idClienteCheckin = 'id-1';
        registro.idClienteCheckout = null;
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

    const jornadas = await database
      .get<Jornada>('jornadas')
      .query(Q.where('status', 'EM_ANDAMENTO'))
      .fetch();
    const bancoHoras = await database.get<BancoHoras>('banco_horas').query(Q.where('mes', 9)).fetch();
    const pendentes = await database
      .get<AcaoPendente>('acoes_pendentes')
      .query(Q.where('status', 'pendente'))
      .fetch();

    expect(jornadas).toHaveLength(1);
    expect(jornadas[0].checkinEndereco).toBe('Rua Falsa, 123');
    expect(bancoHoras).toHaveLength(1);
    expect(bancoHoras[0].saldo).toBe(-166);
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].idCliente).toBe('id-1');
  });
});
