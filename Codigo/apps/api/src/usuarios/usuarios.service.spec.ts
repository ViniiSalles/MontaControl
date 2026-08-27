import { Perfil } from '../../generated/prisma';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let repository: { listar: jest.Mock };
  let service: UsuariosService;

  beforeEach(() => {
    repository = { listar: jest.fn() };
    service = new UsuariosService(repository as unknown as UsuariosRepository);
  });

  describe('listar', () => {
    it('delega ao repositório', async () => {
      const usuarios = [
        { id: 1, nome: 'Ana RH', email: 'ana@montacontrol.local', perfil: Perfil.RH, ativo: true },
      ];
      repository.listar.mockResolvedValue(usuarios);

      const resultado = await service.listar();

      expect(resultado).toEqual(usuarios);
      expect(repository.listar).toHaveBeenCalled();
    });
  });
});
