import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { AluguelEpi, AlugueisEpiRepository, VerificacaoEstoque } from './alugueis-epi.repository';
import { AlugueisEpiService } from './alugueis-epi.service';

const AGORA = new Date('2026-10-27T12:00:00.000Z');
const GESTOR_ID = 1;

function aluguel(parcial: Partial<AluguelEpi> = {}): AluguelEpi {
  return {
    id: 10,
    quantidade: 1,
    inicio: new Date('2026-10-27T08:00:00.000Z'),
    fimPrevisto: new Date('2026-10-27T18:00:00.000Z'),
    devolvidoEm: null,
    observacao: null,
    tipoEpi: { id: 2, nome: 'Luva' },
    usuario: { id: 5, nome: 'Ana' },
    registrador: { id: GESTOR_ID, nome: 'Gestor' },
    registradorDevolucao: null,
    ...parcial,
  };
}

const pedido = {
  tipoEpiId: 2,
  usuarioId: 5,
  quantidade: 2,
  inicio: '2026-10-28T08:00:00.000Z',
  fimPrevisto: '2026-10-28T17:00:00.000Z',
};

describe('AlugueisEpiService', () => {
  let alugueis: {
    listar: jest.Mock;
    buscarPorId: jest.Mock;
    criarSeCouber: jest.Mock;
    registrarDevolucao: jest.Mock;
    removerSeReservado: jest.Mock;
  };
  let usuarios: { buscarPorId: jest.Mock };
  let service: AlugueisEpiService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
    alugueis = {
      listar: jest.fn(),
      buscarPorId: jest.fn().mockResolvedValue(aluguel()),
      criarSeCouber: jest.fn().mockResolvedValue(aluguel()),
      registrarDevolucao: jest.fn((id: number, devolvidoEm: Date) =>
        Promise.resolve(aluguel({ id, devolvidoEm, registradorDevolucao: { id: GESTOR_ID, nome: 'Gestor' } })),
      ),
      removerSeReservado: jest.fn().mockResolvedValue(true),
    };
    usuarios = { buscarPorId: jest.fn().mockResolvedValue({ id: 5, nome: 'Ana', ativo: true }) };
    service = new AlugueisEpiService(
      alugueis as unknown as AlugueisEpiRepository,
      usuarios as unknown as UsuariosRepository,
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('listar', () => {
    it('deriva o status de cada aluguel a partir das datas', async () => {
      alugueis.listar.mockResolvedValue([
        aluguel({ id: 1, inicio: new Date('2026-10-28T08:00:00Z'), fimPrevisto: new Date('2026-10-28T18:00:00Z') }),
        aluguel({ id: 2 }),
        aluguel({ id: 3, fimPrevisto: new Date('2026-10-27T10:00:00Z') }),
        aluguel({ id: 4, devolvidoEm: new Date('2026-10-27T09:00:00Z') }),
      ]);

      const lista = await service.listar();

      expect(lista.map((item) => item.status)).toEqual(['RESERVADO', 'EM_USO', 'ATRASADO', 'DEVOLVIDO']);
      expect(lista[3].devolvidoEm).toBe('2026-10-27T09:00:00.000Z');
      expect(lista[0].colaborador).toEqual({ id: 5, nome: 'Ana' });
    });
  });

  describe('registrar', () => {
    it('grava o gestor que registrou e a observação aparada', async () => {
      await service.registrar({ ...pedido, observacao: '  obra Centro ' }, GESTOR_ID);

      expect(alugueis.criarSeCouber).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEpiId: 2,
          usuarioId: 5,
          quantidade: 2,
          inicio: new Date(pedido.inicio),
          fimPrevisto: new Date(pedido.fimPrevisto),
          observacao: 'obra Centro',
          registradoPor: GESTOR_ID,
        }),
        expect.any(Function),
      );
    });

    it('observação em branco vira null', async () => {
      await service.registrar({ ...pedido, observacao: '   ' }, GESTOR_ID);

      expect(alugueis.criarSeCouber).toHaveBeenCalledWith(expect.objectContaining({ observacao: null }), expect.any(Function));
    });

    it('devolução prevista antes ou igual ao início é 422', async () => {
      await expect(service.registrar({ ...pedido, fimPrevisto: pedido.inicio }, GESTOR_ID)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(alugueis.criarSeCouber).not.toHaveBeenCalled();
    });

    it.each([null, { id: 5, nome: 'Ana', ativo: false }])('colaborador inexistente ou inativo é 422 (%p)', async (colaborador) => {
      usuarios.buscarPorId.mockResolvedValue(colaborador);

      await expect(service.registrar(pedido, GESTOR_ID)).rejects.toThrow(UnprocessableEntityException);
      expect(alugueis.criarSeCouber).not.toHaveBeenCalled();
    });

    it('a verificação de estoque considera o pico do período mais a quantidade pedida', async () => {
      await service.registrar(pedido, GESTOR_ID);
      const cabe = alugueis.criarSeCouber.mock.calls[0][1] as VerificacaoEstoque;
      const ocupacao = {
        inicio: new Date('2026-10-28T07:00:00Z'),
        fimPrevisto: new Date('2026-10-28T12:00:00Z'),
        devolvidoEm: null,
        quantidade: 3,
      };

      expect(cabe([ocupacao], 5)).toBe(true);
      expect(cabe([ocupacao], 4)).toBe(false);
      expect(cabe([], 2)).toBe(true);
      expect(cabe([], 1)).toBe(false);
    });

    it('sem estoque no período é 409', async () => {
      alugueis.criarSeCouber.mockResolvedValue('SEM_ESTOQUE');

      await expect(service.registrar(pedido, GESTOR_ID)).rejects.toThrow(ConflictException);
    });

    it('tipo de EPI inexistente é 404', async () => {
      alugueis.criarSeCouber.mockResolvedValue('TIPO_NAO_ENCONTRADO');

      await expect(service.registrar(pedido, GESTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('registrarDevolucao', () => {
    it('sem data informada, devolve agora e grava quem registrou', async () => {
      const devolvido = await service.registrarDevolucao(10, {}, GESTOR_ID);

      expect(alugueis.registrarDevolucao).toHaveBeenCalledWith(10, AGORA, GESTOR_ID);
      expect(devolvido.status).toBe('DEVOLVIDO');
      expect(devolvido.devolucaoRegistradaPor).toEqual({ id: GESTOR_ID, nome: 'Gestor' });
    });

    it('aceita devolução retroativa dentro do período', async () => {
      await service.registrarDevolucao(10, { devolvidoEm: '2026-10-27T10:30:00.000Z' }, GESTOR_ID);

      expect(alugueis.registrarDevolucao).toHaveBeenCalledWith(10, new Date('2026-10-27T10:30:00.000Z'), GESTOR_ID);
    });

    it.each(['2026-10-27T07:59:00.000Z', '2026-10-27T12:05:00.000Z'])(
      'devolução antes do início ou no futuro é 422 (%s)',
      async (devolvidoEm) => {
        await expect(service.registrarDevolucao(10, { devolvidoEm }, GESTOR_ID)).rejects.toThrow(
          UnprocessableEntityException,
        );
        expect(alugueis.registrarDevolucao).not.toHaveBeenCalled();
      },
    );

    it('aluguel inexistente é 404', async () => {
      alugueis.buscarPorId.mockResolvedValue(null);

      await expect(service.registrarDevolucao(99, {}, GESTOR_ID)).rejects.toThrow(NotFoundException);
    });

    it('aluguel já devolvido é 409', async () => {
      alugueis.buscarPorId.mockResolvedValue(aluguel({ devolvidoEm: new Date('2026-10-27T09:00:00Z') }));

      await expect(service.registrarDevolucao(10, {}, GESTOR_ID)).rejects.toThrow(ConflictException);
      expect(alugueis.registrarDevolucao).not.toHaveBeenCalled();
    });

    it('devolução concorrente (já gravada por outra requisição) é 409', async () => {
      alugueis.registrarDevolucao.mockResolvedValue(null);

      await expect(service.registrarDevolucao(10, {}, GESTOR_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelar', () => {
    it('cancela reserva que ainda não começou', async () => {
      await service.cancelar(10);

      expect(alugueis.removerSeReservado).toHaveBeenCalledWith(10, AGORA);
    });

    it('aluguel já iniciado não pode ser cancelado (409)', async () => {
      alugueis.removerSeReservado.mockResolvedValue(false);

      await expect(service.cancelar(10)).rejects.toThrow(ConflictException);
    });

    it('aluguel inexistente é 404', async () => {
      alugueis.buscarPorId.mockResolvedValue(null);

      await expect(service.cancelar(99)).rejects.toThrow(NotFoundException);
      expect(alugueis.removerSeReservado).not.toHaveBeenCalled();
    });
  });
});
