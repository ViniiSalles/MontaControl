import { UnauthorizedException } from '@nestjs/common';
import { Perfil } from '../../generated/prisma';
import { SupabaseAuthGateway } from '../supabase/supabase-auth.gateway';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { AuthService } from './auth.service';

const sessaoValida = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
  authUserId: '11111111-1111-1111-1111-111111111111',
  email: 'maria@montacontrol.local',
};

const usuarioAtivo = {
  id: 1,
  nome: 'Maria Montadora',
  email: 'maria@montacontrol.local',
  perfil: Perfil.MONTADOR,
  ativo: true,
  authUserId: '11111111-1111-1111-1111-111111111111',
};

describe('AuthService', () => {
  let supabase: { entrarComSenha: jest.Mock };
  let usuarios: { buscarPorAuthUserId: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    supabase = { entrarComSenha: jest.fn() };
    usuarios = { buscarPorAuthUserId: jest.fn() };
    service = new AuthService(
      supabase as unknown as SupabaseAuthGateway,
      usuarios as unknown as UsuariosRepository,
    );
  });

  describe('login — N1T1: credenciais válidas', () => {
    it('retorna a sessão e o usuário quando credenciais são válidas e o usuário está ativo', async () => {
      supabase.entrarComSenha.mockResolvedValue(sessaoValida);
      usuarios.buscarPorAuthUserId.mockResolvedValue(usuarioAtivo);

      const resultado = await service.login('maria@montacontrol.local', 'senha-correta');

      expect(resultado.sessao).toEqual(sessaoValida);
      expect(resultado.usuario).toEqual(usuarioAtivo);
      expect(supabase.entrarComSenha).toHaveBeenCalledWith(
        'maria@montacontrol.local',
        'senha-correta',
      );
    });
  });

  describe('login — N1T2: senha incorreta', () => {
    it('rejeita com 401 "Credenciais inválidas" (nunca 400)', async () => {
      supabase.entrarComSenha.mockResolvedValue(null);

      await expect(service.login('maria@montacontrol.local', 'senha-errada')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('maria@montacontrol.local', 'senha-errada')).rejects.toThrow(
        'Credenciais inválidas',
      );
    });
  });

  describe('login — usuário autenticado no GoTrue sem linha correspondente em usuario', () => {
    it('rejeita com a MESMA mensagem de senha incorreta (sem vazar qual etapa falhou)', async () => {
      supabase.entrarComSenha.mockResolvedValue(sessaoValida);
      usuarios.buscarPorAuthUserId.mockResolvedValue(null);

      await expect(service.login('orfao@montacontrol.local', 'qualquer-senha')).rejects.toThrow(
        'Credenciais inválidas',
      );
    });
  });

  describe('login — usuário desativado (soft delete)', () => {
    it('rejeita com a MESMA mensagem de senha incorreta', async () => {
      supabase.entrarComSenha.mockResolvedValue(sessaoValida);
      usuarios.buscarPorAuthUserId.mockResolvedValue({ ...usuarioAtivo, ativo: false });

      await expect(service.login('maria@montacontrol.local', 'senha-correta')).rejects.toThrow(
        'Credenciais inválidas',
      );
    });
  });
});
