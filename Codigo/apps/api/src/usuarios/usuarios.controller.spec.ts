import { Perfil } from '../../generated/prisma';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController', () => {
  let usuarios: { listar: jest.Mock };
  let controller: UsuariosController;

  beforeEach(() => {
    usuarios = { listar: jest.fn() };
    controller = new UsuariosController(usuarios as unknown as UsuariosService);
  });

  describe('listar', () => {
    it('mapeia os usuários listados para UsuarioDTO', async () => {
      usuarios.listar.mockResolvedValue([
        { id: 1, nome: 'Ana RH', email: 'ana@montacontrol.local', perfil: Perfil.RH, ativo: true },
      ]);

      const resultado = await controller.listar();

      expect(resultado).toEqual([
        { id: 1, nome: 'Ana RH', email: 'ana@montacontrol.local', perfil: Perfil.RH, ativo: true },
      ]);
    });
  });
});
