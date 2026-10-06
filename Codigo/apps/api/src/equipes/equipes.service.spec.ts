import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FotosUsuarios } from '../usuarios/fotos-usuarios';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { EquipesRepository } from './equipes.repository';
import { EquipesService } from './equipes.service';

const equipe = { id: 1, nome: 'Equipe Norte', membros: [] };

describe('EquipesService', () => {
  let equipes: { listar: jest.Mock; criar: jest.Mock; atualizar: jest.Mock; remover: jest.Mock };
  let usuarios: { filtrarMontadoresAtivos: jest.Mock };
  let fotos: { comUrls: jest.Mock };
  let service: EquipesService;

  beforeEach(() => {
    equipes = {
      listar: jest.fn(),
      criar: jest.fn().mockResolvedValue(equipe),
      atualizar: jest.fn().mockResolvedValue(equipe),
      remover: jest.fn().mockResolvedValue(true),
    };
    usuarios = { filtrarMontadoresAtivos: jest.fn((ids: number[]) => Promise.resolve(ids)) };
    fotos = {
      comUrls: jest.fn((itens: Array<{ fotoPath: string | null }>) =>
        Promise.resolve(itens.map((item) => ({ ...item, fotoUrl: item.fotoPath ? `https://assinada/${item.fotoPath}` : null }))),
      ),
    };
    service = new EquipesService(
      equipes as unknown as EquipesRepository,
      usuarios as unknown as UsuariosRepository,
      fotos as unknown as FotosUsuarios,
    );
  });

  it('listar troca o caminho da foto por URL assinada e não vaza o caminho', async () => {
    equipes.listar.mockResolvedValue([
      {
        id: 1,
        nome: 'Norte',
        membros: [
          { id: 3, nome: 'Ana', ativo: true, email: 'a@x', telefone: null, fotoPath: 'abc.jpg' },
          { id: 4, nome: 'Bia', ativo: true, email: 'b@x', telefone: '31999998888', fotoPath: null },
        ],
      },
    ]);

    const [equipe] = await service.listar();

    expect(equipe.membros).toEqual([
      { id: 3, nome: 'Ana', ativo: true, email: 'a@x', telefone: null, fotoUrl: 'https://assinada/abc.jpg' },
      { id: 4, nome: 'Bia', ativo: true, email: 'b@x', telefone: '31999998888', fotoUrl: null },
    ]);
    expect(JSON.stringify(equipe)).not.toContain('fotoPath');
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
