import { Perfil } from '../../generated/prisma';
import { CadastrarUsuarioDto } from './dto/cadastrar-usuario.dto';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

const criadoEm = new Date('2026-09-01T12:00:00.000Z');

describe('UsuariosController', () => {
  let usuarios: { listar: jest.Mock; cadastrar: jest.Mock; informarCpf: jest.Mock };
  let controller: UsuariosController;

  beforeEach(() => {
    usuarios = { listar: jest.fn(), cadastrar: jest.fn(), informarCpf: jest.fn() };
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
          cpf: null,
          createdAt: criadoEm,
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
          cpf: null,
          criadoEm: criadoEm.toISOString(),
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
        cpf: '52998224725',
        createdAt: criadoEm,
      });

      const resultado = await controller.cadastrar(dto);

      expect(resultado).toEqual({
        id: 9,
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
        perfil: dto.perfil,
        ativo: true,
        cpf: '52998224725',
        criadoEm: criadoEm.toISOString(),
      });
      expect(usuarios.cadastrar).toHaveBeenCalledWith(dto);
    });
  });

  describe('informarCpf', () => {
    it('delega ao service e mapeia o usuário com cpf e criadoEm', async () => {
      usuarios.informarCpf.mockResolvedValue({
        id: 4,
        nome: 'Maria',
        email: 'maria@montacontrol.local',
        telefone: null,
        perfil: Perfil.MONTADOR,
        ativo: true,
        cpf: '52998224725',
        createdAt: criadoEm,
      });

      const resultado = await controller.informarCpf(4, { cpf: '529.982.247-25' });

      expect(usuarios.informarCpf).toHaveBeenCalledWith(4, '529.982.247-25');
      expect(resultado.cpf).toBe('52998224725');
      expect(resultado.criadoEm).toBe(criadoEm.toISOString());
    });
  });
});
