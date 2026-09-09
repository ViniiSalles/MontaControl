import { Perfil } from '../../generated/prisma';
import { AtestadosRepository } from '../atestados/atestados.repository';
import { JornadasRepository } from '../jornadas/jornadas.repository';
import { PontosEmAtrasoRepository } from '../pontos-em-atraso/pontos-em-atraso.repository';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { BancoHorasRepository } from './banco-horas.repository';
import { BancoHorasService } from './banco-horas.service';

/** Setembro/2026: 22 dias úteis × 8 h = 176 h previstas. */
const ANO = 2026;
const MES = 9;

function jornada(dia: string, horaInicio: string, horaFim: string) {
  return {
    id: 1,
    usuarioId: 7,
    status: 'FINALIZADA',
    checkinAt: `${dia}T${horaInicio}:00.000Z`,
    checkinLatitude: null,
    checkinLongitude: null,
    checkinEndereco: null,
    checkoutAt: `${dia}T${horaFim}:00.000Z`,
    checkoutLatitude: null,
    checkoutLongitude: null,
    checkoutEndereco: null,
    lancadoEmAtraso: false,
    criadoEm: `${dia}T${horaInicio}:00.000Z`,
  };
}

describe('BancoHorasService', () => {
  let jornadas: { listarNoPeriodo: jest.Mock };
  let atestados: { listarValidadosNoPeriodo: jest.Mock };
  let pontos: { contarPendentesPorUsuario: jest.Mock };
  let usuarios: { listar: jest.Mock };
  let banco: { salvarSnapshot: jest.Mock };
  let service: BancoHorasService;

  beforeEach(() => {
    jornadas = { listarNoPeriodo: jest.fn().mockResolvedValue([]) };
    atestados = { listarValidadosNoPeriodo: jest.fn().mockResolvedValue([]) };
    pontos = { contarPendentesPorUsuario: jest.fn().mockResolvedValue(new Map()) };
    usuarios = { listar: jest.fn().mockResolvedValue([]) };
    banco = { salvarSnapshot: jest.fn().mockImplementation((dados) => ({ id: 1, ...dados })) };
    service = new BancoHorasService(
      banco as unknown as BancoHorasRepository,
      jornadas as unknown as JornadasRepository,
      atestados as unknown as AtestadosRepository,
      pontos as unknown as PontosEmAtrasoRepository,
      usuarios as unknown as UsuariosRepository,
    );
  });

  it('sem jornada e sem atestado, o saldo é o mês inteiro devendo', async () => {
    const resultado = await service.doMontador(7, ANO, MES);

    expect(resultado.horasPrevistas).toBe(176);
    expect(resultado.horasTrabalhadas).toBe(0);
    expect(resultado.horasAbonadas).toBe(0);
    expect(resultado.saldo).toBe(-176);
  });

  it('soma as horas das jornadas finalizadas do mês', async () => {
    jornadas.listarNoPeriodo.mockResolvedValue([
      jornada('2026-09-01', '11:00', '20:00'), // 9 h
      jornada('2026-09-02', '11:00', '18:00'), // 7 h
    ]);

    const resultado = await service.doMontador(7, ANO, MES);

    expect(resultado.horasTrabalhadas).toBe(16);
    expect(resultado.saldo).toBe(16 - 176);
  });

  it('abona os dias úteis do atestado validado, reduzindo a dívida', async () => {
    atestados.listarValidadosNoPeriodo.mockResolvedValue([
      { dataInicio: '2026-09-01', dataFim: '2026-09-04' }, // ter a sex: 4 dias úteis
    ]);

    const resultado = await service.doMontador(7, ANO, MES);

    expect(resultado.horasAbonadas).toBe(32);
    expect(resultado.saldo).toBe(-144);
  });

  it('grava o snapshot em banco_horas a cada leitura', async () => {
    await service.doMontador(7, ANO, MES);

    expect(banco.salvarSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 7, ano: ANO, mes: MES, saldo: -176 }),
    );
  });

  it('lista só montadores no painel da equipe, com as compensações pendentes', async () => {
    usuarios.listar.mockResolvedValue([
      { id: 7, nome: 'Montador Um', email: 'm1@x.local', perfil: Perfil.MONTADOR, ativo: true },
      { id: 8, nome: 'Ana RH', email: 'rh@x.local', perfil: Perfil.RH, ativo: true },
    ]);
    pontos.contarPendentesPorUsuario.mockResolvedValue(new Map([[7, 2]]));

    const resultado = await service.listarDaEquipe(ANO, MES);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].usuarioNome).toBe('Montador Um');
    expect(resultado[0].compensacoesPendentes).toBe(2);
  });
});
