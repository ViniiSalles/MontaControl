import { PrismaService } from '../prisma/prisma.service';
import { Perfil } from '../../generated/prisma';
import { UsuariosRepository } from './usuarios.repository';

describe('UsuariosRepository', () => {
  let prisma: { usuario: { findUnique: jest.Mock } };
  let repository: UsuariosRepository;

  beforeEach(() => {
    prisma = { usuario: { findUnique: jest.fn() } };
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

      const usuario = await repository.buscarPorAuthUserId(
        '11111111-1111-1111-1111-111111111111',
      );

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
});
