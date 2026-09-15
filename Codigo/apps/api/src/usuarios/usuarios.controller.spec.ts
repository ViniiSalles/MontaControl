import { Perfil } from '../../generated/prisma';
import { CadastrarUsuarioDto } from './dto/cadastrar-usuario.dto';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

describe('UsuariosController', () => {
  let usuarios: { listar: jest.Mock; cadastrar: jest.Mock };
  let controller: UsuariosController;

  beforeEach(() => {
    usuarios = { listar: jest.fn(), cadastrar: jest.fn() };
    controller = new UsuariosController(usuarios as unknown as UsuariosService);
  });

  describe('listar', () => {
    it('mapeia os usuários listados para UsuarioDTO', async () => {
      usuarios.listar.mockResolvedValue([
        {
          id: 1,
          nome: 'Ana RH',
          email: 'ana@montacontrol.local',
          telefone: null,
          perfil: Perfil.RH,
          ativo: true,
        },
      ]);

      const resultado = await controller.listar();

      expect(resultado).toEqual([
        {
          id: 1,
          nome: 'Ana RH',
          email: 'ana@montacontrol.local',
          telefone: null,
          perfil: Perfil.RH,
          ativo: true,
        },
      ]);
    });
  });

  describe('cadastrar', () => {
    it('delega ao service e mapeia o usuário criado para UsuarioDTO', async () => {
      const dto: CadastrarUsuarioDto = {
        nome: 'Nova Montadora',
        email: 'nova@montacontrol.local',
        senha: 'senha-longa-123',
        telefone: '(11) 91234-5678',
        perfil: Perfil.MONTADOR,
      };
      usuarios.cadastrar.mockResolvedValue({
        id: 9,
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone ?? null,
        perfil: dto.perfil,
        ativo: true,
      });

      const resultado = await controller.cadastrar(dto);

      expect(resultado).toEqual({
        id: 9,
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
        perfil: dto.perfil,
        ativo: true,
      });
      expect(usuarios.cadastrar).toHaveBeenCalledWith(dto);
    });
  });
});
