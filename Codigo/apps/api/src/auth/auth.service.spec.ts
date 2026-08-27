import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  let supabase: {
    entrarComSenha: jest.Mock;
    renovarSessao: jest.Mock;
    solicitarRecuperacaoSenha: jest.Mock;
    verificarTokenRecuperacao: jest.Mock;
    atualizarSenha: jest.Mock;
    encerrarSessao: jest.Mock;
  };
  let usuarios: { buscarPorAuthUserId: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    supabase = {
      entrarComSenha: jest.fn(),
      renovarSessao: jest.fn(),
      solicitarRecuperacaoSenha: jest.fn(),
      verificarTokenRecuperacao: jest.fn(),
      atualizarSenha: jest.fn(),
      encerrarSessao: jest.fn(),
    };
    usuarios = { buscarPorAuthUserId: jest.fn() };
    const config = { getOrThrow: jest.fn().mockReturnValue('https://app/redefinir-senha') };
    service = new AuthService(
      supabase as unknown as SupabaseAuthGateway,
      usuarios as unknown as UsuariosRepository,
      config as unknown as ConfigService,
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

  describe('refresh — TI02: renovação de sessão', () => {
    it('retorna a sessão renovada quando o refresh token é válido e o usuário está ativo', async () => {
      supabase.renovarSessao.mockResolvedValue(sessaoValida);
      usuarios.buscarPorAuthUserId.mockResolvedValue(usuarioAtivo);

      const resultado = await service.refresh('refresh-token');

      expect(resultado.sessao).toEqual(sessaoValida);
      expect(supabase.renovarSessao).toHaveBeenCalledWith('refresh-token');
    });

    it('rejeita com 401 "Sessão expirada" quando o refresh token é inválido', async () => {
      supabase.renovarSessao.mockResolvedValue(null);

      await expect(service.refresh('refresh-token-invalido')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejeita quando o usuário associado ao refresh token foi desativado', async () => {
      supabase.renovarSessao.mockResolvedValue(sessaoValida);
      usuarios.buscarPorAuthUserId.mockResolvedValue({ ...usuarioAtivo, ativo: false });

      await expect(service.refresh('refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('solicitarRecuperacaoSenha', () => {
    it('delega ao gateway com o redirect configurado, mesmo para e-mail inexistente', async () => {
      await service.solicitarRecuperacaoSenha('inexistente@montacontrol.local');

      expect(supabase.solicitarRecuperacaoSenha).toHaveBeenCalledWith(
        'inexistente@montacontrol.local',
        'https://app/redefinir-senha',
      );
    });
  });

  describe('redefinirSenha', () => {
    it('atualiza a senha quando o token de recuperação é válido', async () => {
      supabase.verificarTokenRecuperacao.mockResolvedValue(sessaoValida.authUserId);
      supabase.atualizarSenha.mockResolvedValue(true);

      await expect(
        service.redefinirSenha('maria@montacontrol.local', 'otp-valido', 'nova-senha-123'),
      ).resolves.toBeUndefined();
      expect(supabase.atualizarSenha).toHaveBeenCalledWith(
        sessaoValida.authUserId,
        'nova-senha-123',
      );
    });

    it('rejeita com 400 quando o token de recuperação é inválido ou expirado', async () => {
      supabase.verificarTokenRecuperacao.mockResolvedValue(null);

      await expect(
        service.redefinirSenha('maria@montacontrol.local', 'otp-expirado', 'nova-senha-123'),
      ).rejects.toThrow(BadRequestException);
      expect(supabase.atualizarSenha).not.toHaveBeenCalled();
    });

    it('rejeita com 400 quando o GoTrue recusa a atualização de senha', async () => {
      supabase.verificarTokenRecuperacao.mockResolvedValue(sessaoValida.authUserId);
      supabase.atualizarSenha.mockResolvedValue(false);

      await expect(
        service.redefinirSenha('maria@montacontrol.local', 'otp-valido', 'curta'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sair', () => {
    it('delega ao gateway a revogação do access token', async () => {
      await service.sair('access-token');

      expect(supabase.encerrarSessao).toHaveBeenCalledWith('access-token');
    });
  });
});
