import type { BancoHorasDTO } from '@montacontrol/shared';
import { criarBancoDeTeste } from '../../db/__tests__/apoio';
import { paraBancoHorasDTO, queryBancoHoras, upsertBancoHoras } from '../espelhoBancoHoras';

function bancoHorasFalso(parcial: Partial<BancoHorasDTO> = {}): BancoHorasDTO {
  return { id: 1, usuarioId: 3, mes: 9, ano: 2026, horasTrabalhadas: 10, horasPrevistas: 176, saldo: -166, ...parcial };
}

describe('upsertBancoHoras', () => {
  it('cria e depois atualiza (não duplica) o mesmo mes/ano', async () => {
    const database = criarBancoDeTeste();

    await upsertBancoHoras(database, bancoHorasFalso({ saldo: -166 }));
    await upsertBancoHoras(database, bancoHorasFalso({ saldo: -158 }));

    const registros = await queryBancoHoras(database, 9, 2026).fetch();

    expect(registros).toHaveLength(1);
    expect(paraBancoHorasDTO(registros[0]).saldo).toBe(-158);
  });

  it('meses diferentes viram linhas diferentes', async () => {
    const database = criarBancoDeTeste();

    await upsertBancoHoras(database, bancoHorasFalso({ mes: 8, saldo: -100 }));
    await upsertBancoHoras(database, bancoHorasFalso({ mes: 9, saldo: -166 }));

    const agosto = await queryBancoHoras(database, 8, 2026).fetch();
    const setembro = await queryBancoHoras(database, 9, 2026).fetch();

    expect(paraBancoHorasDTO(agosto[0]).saldo).toBe(-100);
    expect(paraBancoHorasDTO(setembro[0]).saldo).toBe(-166);
  });
});
