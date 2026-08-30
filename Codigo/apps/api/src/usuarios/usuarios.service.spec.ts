import { ConflictException } from '@nestjs/common';
import { Perfil } from '../../generated/prisma';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

const dadosCadastro = {
  nome: 'Nova Montadora',
  email: 'nova@montacontrol.local',
  senha: 'senha-longa-123',
  perfil: Perfil.MONTADOR,
};

const authUserId = '22222222-2222-2222-2222-222222222222';

describe('UsuariosService', () => {
  let repository: { listar: jest.Mock; criar: jest.Mock };
  let supabase: { criarUsuario: jest.Mock; excluirUsuario: jest.Mock };
  let service: UsuariosService;

  beforeEach(() => {
    repository = { listar: jest.fn(), criar: jest.fn() };
    supabase = { criarUsuario: jest.fn(), excluirUsuario: jest.fn() };
    service = new UsuariosService(
      repository as unknown as UsuariosRepository,
      supabase as unknown as SupabaseAuthGateway,
    );
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

  describe('cadastrar', () => {
    it('cria o usuário no Supabase e no Postgres, nessa ordem', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue({
        id: 9,
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        perfil: dadosCadastro.perfil,
        ativo: true,
      });

      const usuario = await service.cadastrar(dadosCadastro);

      expect(usuario).toEqual({
        id: 9,
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        perfil: dadosCadastro.perfil,
        ativo: true,
      });
      expect(supabase.criarUsuario).toHaveBeenCalledWith(dadosCadastro.email, dadosCadastro.senha);
      expect(repository.criar).toHaveBeenCalledWith({
        nome: dadosCadastro.nome,
        email: dadosCadastro.email,
        perfil: dadosCadastro.perfil,
        authUserId,
      });
      expect(supabase.excluirUsuario).not.toHaveBeenCalled();
    });

    it('rejeita com 409 quando o e-mail já existe no Supabase Auth', async () => {
      supabase.criarUsuario.mockResolvedValue(null);

      await expect(service.cadastrar(dadosCadastro)).rejects.toThrow(ConflictException);
      expect(repository.criar).not.toHaveBeenCalled();
    });

    it('desfaz a criação no Supabase quando o Postgres rejeita por conflito tardio', async () => {
      supabase.criarUsuario.mockResolvedValue(authUserId);
      repository.criar.mockResolvedValue(null);

      await expect(service.cadastrar(dadosCadastro)).rejects.toThrow(ConflictException);
      expect(supabase.excluirUsuario).toHaveBeenCalledWith(authUserId);
    });
  });
});
