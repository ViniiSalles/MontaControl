import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { Perfil } from '../../generated/prisma';
import { UsuariosRepository } from './usuarios.repository';

function erroConflito(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '0.0.0',
  });
}

describe('UsuariosRepository', () => {
  let prisma: { usuario: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock } };
  let repository: UsuariosRepository;

  beforeEach(() => {
    prisma = {
      usuario: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    };
    repository = new UsuariosRepository(prisma as unknown as PrismaService);
  });

  describe('buscarPorAuthUserId', () => {
    it('retorna o usuário mapeado quando encontrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        perfil: Perfil.MONTADOR,
        ativo: true,
        authUserId: '11111111-1111-1111-1111-111111111111',
      });

      const usuario = await repository.buscarPorAuthUserId('11111111-1111-1111-1111-111111111111');

      expect(usuario).toEqual({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        perfil: Perfil.MONTADOR,
        ativo: true,
        authUserId: '11111111-1111-1111-1111-111111111111',
      });
      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { authUserId: '11111111-1111-1111-1111-111111111111' },
        select: { id: true, nome: true, email: true, perfil: true, ativo: true, authUserId: true },
      });
    });

    it('retorna null quando não há usuário com o authUserId informado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const usuario = await repository.buscarPorAuthUserId('inexistente');

      expect(usuario).toBeNull();
    });
  });

  describe('buscarPorId', () => {
    it('retorna o usuário mapeado quando encontrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        telefone: '(11) 91234-5678',
        perfil: Perfil.MONTADOR,
        ativo: true,
      });

      const usuario = await repository.buscarPorId(7);

      expect(usuario).toEqual({
        id: 7,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        telefone: '(11) 91234-5678',
        perfil: Perfil.MONTADOR,
        ativo: true,
      });
      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        select: { id: true, nome: true, email: true, telefone: true, perfil: true, ativo: true },
      });
    });

    it('retorna null quando não há usuário com o id informado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      const usuario = await repository.buscarPorId(999);

      expect(usuario).toBeNull();
    });
  });

  describe('listar', () => {
    it('retorna os usuários ordenados por nome, sem o authUserId', async () => {
      const usuarios = [
        {
          id: 1,
          nome: 'Ana RH',
          email: 'ana@montacontrol.local',
          telefone: null,
          perfil: Perfil.RH,
          ativo: true,
        },
      ];
      prisma.usuario.findMany.mockResolvedValue(usuarios);

      const resultado = await repository.listar();

      expect(resultado).toEqual(usuarios);
      expect(prisma.usuario.findMany).toHaveBeenCalledWith({
        select: { id: true, nome: true, email: true, telefone: true, perfil: true, ativo: true },
        orderBy: { nome: 'asc' },
      });
    });
  });

  describe('criar', () => {
    const dados = {
      nome: 'Nova Montadora',
      email: 'nova@montacontrol.local',
      telefone: '(11) 91234-5678',
      perfil: Perfil.MONTADOR,
      authUserId: '22222222-2222-2222-2222-222222222222',
    };

    it('cria o usuário e retorna a projeção sem authUserId', async () => {
      prisma.usuario.create.mockResolvedValue({
        id: 9,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        perfil: dados.perfil,
        ativo: true,
      });

      const usuario = await repository.criar(dados);

      expect(usuario).toEqual({
        id: 9,
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        perfil: dados.perfil,
        ativo: true,
      });
      expect(prisma.usuario.create).toHaveBeenCalledWith({
        data: dados,
        select: { id: true, nome: true, email: true, telefone: true, perfil: true, ativo: true },
      });
    });

    it('retorna null quando o e-mail ou authUserId já existem (P2002)', async () => {
      prisma.usuario.create.mockRejectedValue(erroConflito());

      const usuario = await repository.criar(dados);

      expect(usuario).toBeNull();
    });

    it('propaga outros erros do Postgres', async () => {
      prisma.usuario.create.mockRejectedValue(new Error('conexão perdida'));

      await expect(repository.criar(dados)).rejects.toThrow('conexão perdida');
    });
  });
});
