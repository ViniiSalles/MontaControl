import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { EquipesRepository } from './equipes.repository';
import { EquipesService } from './equipes.service';

const equipe = { id: 1, nome: 'Equipe Norte', membros: [] };

describe('EquipesService', () => {
  let equipes: { listar: jest.Mock; criar: jest.Mock; atualizar: jest.Mock; remover: jest.Mock };
  let usuarios: { filtrarMontadoresAtivos: jest.Mock };
  let service: EquipesService;

  beforeEach(() => {
    equipes = {
      listar: jest.fn(),
      criar: jest.fn().mockResolvedValue(equipe),
      atualizar: jest.fn().mockResolvedValue(equipe),
      remover: jest.fn().mockResolvedValue(true),
    };
    usuarios = { filtrarMontadoresAtivos: jest.fn((ids: number[]) => Promise.resolve(ids)) };
    service = new EquipesService(
      equipes as unknown as EquipesRepository,
      usuarios as unknown as UsuariosRepository,
    );
  });

  it('cria com nome aparado e membros sem repetição', async () => {
    await service.criar({ nome: '  Equipe Norte ', membrosIds: [3, 4, 3] });

    expect(equipes.criar).toHaveBeenCalledWith('Equipe Norte', [3, 4]);
  });

  it('equipe vazia é permitida', async () => {
    await service.criar({ nome: 'Nova', membrosIds: [] });

    expect(equipes.criar).toHaveBeenCalledWith('Nova', []);
  });

  it('recusa membro que não é montador ativo (422)', async () => {
    usuarios.filtrarMontadoresAtivos.mockResolvedValue([3]);

    await expect(service.criar({ nome: 'X', membrosIds: [3, 9] })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(equipes.criar).not.toHaveBeenCalled();
  });

  it('nome repetido é 409', async () => {
    equipes.criar.mockResolvedValue('NOME_DUPLICADO');

    await expect(service.criar({ nome: 'Equipe Norte', membrosIds: [] })).rejects.toThrow(
      ConflictException,
    );
  });

  it('atualizar equipe inexistente é 404', async () => {
    equipes.atualizar.mockResolvedValue('NAO_ENCONTRADA');

    await expect(service.atualizar(9, { nome: 'X', membrosIds: [] })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remover equipe inexistente é 404', async () => {
    equipes.remover.mockResolvedValue(false);

    await expect(service.remover(9)).rejects.toThrow(NotFoundException);
  });
});
