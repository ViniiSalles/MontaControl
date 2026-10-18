import type { SyncBancoHorasRow } from '@montacontrol/shared';
import { criarBancoDeTeste, gravarLinhasNaReplica } from '../../db/__tests__/apoio';
import { paraBancoHorasDTO, queryBancoHoras } from '../espelhoBancoHoras';

function linhaDeBancoHoras(parcial: Partial<SyncBancoHorasRow> = {}): SyncBancoHorasRow {
  return {
    id: '31',
    mes: 9,
    ano: 2026,
    horas_trabalhadas: 10,
    horas_previstas: 176,
    saldo: -166,
    ...parcial,
  };
}

describe('queryBancoHoras', () => {
  it('traz só a linha do mes/ano pedido', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'banco_horas', [
      linhaDeBancoHoras({ id: '1', mes: 8, saldo: -100 }),
      linhaDeBancoHoras({ id: '2', mes: 9, saldo: -166 }),
      linhaDeBancoHoras({ id: '3', mes: 9, ano: 2025, saldo: 5 }),
    ]);

    const agosto = await queryBancoHoras(database, 8, 2026).fetch();
    const setembro = await queryBancoHoras(database, 9, 2026).fetch();

    expect(agosto).toHaveLength(1);
    expect(paraBancoHorasDTO(agosto[0]).saldo).toBe(-100);
    expect(setembro).toHaveLength(1);
    expect(paraBancoHorasDTO(setembro[0]).saldo).toBe(-166);
  });
});

describe('paraBancoHorasDTO', () => {
  it('o id é o do servidor (número) e o usuário, inexistente na réplica, fica no sentinela', async () => {
    const database = criarBancoDeTeste();
    await gravarLinhasNaReplica(database, 'banco_horas', [linhaDeBancoHoras({ id: '32' })]);

    const [registro] = await queryBancoHoras(database, 9, 2026).fetch();

    expect(paraBancoHorasDTO(registro)).toEqual({
      id: 32,
      usuarioId: -1,
      mes: 9,
      ano: 2026,
      horasTrabalhadas: 10,
      horasPrevistas: 176,
      saldo: -166,
    });
  });
});
