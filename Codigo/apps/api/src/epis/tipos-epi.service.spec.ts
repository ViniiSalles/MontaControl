import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AlugueisEpiRepository } from './alugueis-epi.repository';
import { TiposEpiRepository } from './tipos-epi.repository';
import { TiposEpiService } from './tipos-epi.service';

const AGORA = new Date('2026-10-27T12:00:00.000Z');
const luva = { id: 1, nome: 'Luva', descricao: 'Luva de raspa', validadeMeses: 6, estoque: 10 };
const dados = { nome: '  Luva ', descricao: ' Luva de raspa ', validadeMeses: 6, estoque: 10 };

/** Em uso agora: começou e não voltou. */
function emAberto(tipoEpiId: number, quantidade: number, inicio = '2026-10-27T08:00:00Z') {
  return { tipoEpiId, quantidade, inicio: new Date(inicio), fimPrevisto: new Date('2026-10-27T18:00:00Z'), devolvidoEm: null };
}

describe('TiposEpiService', () => {
  let tipos: { listar: jest.Mock; criar: jest.Mock; atualizar: jest.Mock };
  let alugueis: { listarEmAberto: jest.Mock };
  let service: TiposEpiService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
    tipos = {
      listar: jest.fn().mockResolvedValue([luva, { ...luva, id: 2, nome: 'Óculos' }]),
      criar: jest.fn().mockResolvedValue(luva),
      atualizar: jest.fn().mockResolvedValue(luva),
    };
    alugueis = { listarEmAberto: jest.fn().mockResolvedValue([]) };
    service = new TiposEpiService(tipos as unknown as TiposEpiRepository, alugueis as unknown as AlugueisEpiRepository);
  });

  afterEach(() => jest.useRealTimers());

  it('listar soma as unidades em uso agora de cada tipo (reserva futura não conta)', async () => {
    alugueis.listarEmAberto.mockResolvedValue([emAberto(1, 2), emAberto(1, 3), emAberto(1, 4, '2026-10-28T08:00:00Z'), emAberto(2, 1)]);

    const lista = await service.listar();

    expect(lista.map((tipo) => [tipo.nome, tipo.emUso])).toEqual([
      ['Luva', 5],
      ['Óculos', 1],
    ]);
  });

  it('cria com nome e descrição aparados', async () => {
    const criado = await service.criar(dados);

    expect(tipos.criar).toHaveBeenCalledWith({ nome: 'Luva', descricao: 'Luva de raspa', validadeMeses: 6, estoque: 10 });
    expect(criado.emUso).toBe(0);
  });

  it('nome repetido é 409', async () => {
    tipos.criar.mockResolvedValue('NOME_DUPLICADO');

    await expect(service.criar(dados)).rejects.toThrow(ConflictException);
  });

  it('não deixa o estoque ficar abaixo do que está alugado agora (422)', async () => {
    alugueis.listarEmAberto.mockResolvedValue([emAberto(1, 4)]);

    await expect(service.atualizar(1, { ...dados, estoque: 3 })).rejects.toThrow(UnprocessableEntityException);
    expect(tipos.atualizar).not.toHaveBeenCalled();
  });

  it('estoque igual ao em uso é permitido', async () => {
    alugueis.listarEmAberto.mockResolvedValue([emAberto(1, 4), emAberto(2, 9)]);

    const atualizado = await service.atualizar(1, { ...dados, estoque: 4 });

    expect(tipos.atualizar).toHaveBeenCalledWith(1, expect.objectContaining({ estoque: 4 }));
    expect(atualizado.emUso).toBe(4);
  });

  it('atualizar tipo inexistente é 404', async () => {
    tipos.atualizar.mockResolvedValue('NAO_ENCONTRADO');

    await expect(service.atualizar(9, dados)).rejects.toThrow(NotFoundException);
  });
});
