import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthGateway } from './supabase-auth.gateway';

function criarClienteFalso() {
  return {
    auth: {
      signInWithPassword: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      verifyOtp: jest.fn(),
      admin: {
        updateUserById: jest.fn(),
        signOut: jest.fn(),
        createUser: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
  };
}

const sessaoFalsa = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
};

const usuarioFalso = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'maria@montacontrol.local',
};

describe('SupabaseAuthGateway', () => {
  let cliente: ReturnType<typeof criarClienteFalso>;
  let gateway: SupabaseAuthGateway;

  beforeEach(() => {
    cliente = criarClienteFalso();
    gateway = new SupabaseAuthGateway(cliente as unknown as SupabaseClient);
  });

  describe('entrarComSenha', () => {
    it('retorna a sessão mapeada quando as credenciais são válidas', async () => {
      cliente.auth.signInWithPassword.mockResolvedValue({
        data: { session: sessaoFalsa, user: usuarioFalso },
        error: null,
      });

      const sessao = await gateway.entrarComSenha('maria@montacontrol.local', 'senha-correta');

      expect(sessao).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        authUserId: '11111111-1111-1111-1111-111111111111',
        email: 'maria@montacontrol.local',
      });
      expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'maria@montacontrol.local',
        password: 'senha-correta',
      });
    });

    it('retorna null quando as credenciais são inválidas', async () => {
      cliente.auth.signInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      });

      const sessao = await gateway.entrarComSenha('maria@montacontrol.local', 'senha-errada');

      expect(sessao).toBeNull();
    });
  });

  describe('renovarSessao', () => {
    it('retorna a sessão renovada quando o refresh token é válido', async () => {
      cliente.auth.refreshSession.mockResolvedValue({
        data: { session: sessaoFalsa, user: usuarioFalso },
        error: null,
      });

      const sessao = await gateway.renovarSessao('refresh-token');

      expect(sessao?.accessToken).toBe('access-token');
      expect(cliente.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token',
      });
    });

    it('retorna null quando o refresh token é inválido ou revogado', async () => {
      cliente.auth.refreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid Refresh Token' },
      });

      const sessao = await gateway.renovarSessao('refresh-token-invalido');

      expect(sessao).toBeNull();
    });
  });

  describe('solicitarRecuperacaoSenha', () => {
    it('chama o GoTrue e nunca propaga erro (evita enumeração de e-mail)', async () => {
      cliente.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: { message: 'User not found' },
      });

      await expect(
        gateway.solicitarRecuperacaoSenha(
          'inexistente@montacontrol.local',
          'https://app/redefinir',
        ),
      ).resolves.toBeUndefined();
      expect(cliente.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'inexistente@montacontrol.local',
        { redirectTo: 'https://app/redefinir' },
      );
    });
  });

  describe('verificarTokenRecuperacao', () => {
    it('retorna o authUserId quando o token de recuperação é válido', async () => {
      cliente.auth.verifyOtp.mockResolvedValue({
        data: { user: usuarioFalso, session: sessaoFalsa },
        error: null,
      });

      const authUserId = await gateway.verificarTokenRecuperacao(
        'maria@montacontrol.local',
        'otp-valido',
      );

      expect(authUserId).toBe('11111111-1111-1111-1111-111111111111');
      expect(cliente.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'maria@montacontrol.local',
        token: 'otp-valido',
        type: 'recovery',
      });
    });

    it('retorna null quando o token de recuperação é inválido ou expirado', async () => {
      cliente.auth.verifyOtp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Token has expired or is invalid' },
      });

      const authUserId = await gateway.verificarTokenRecuperacao(
        'maria@montacontrol.local',
        'otp-expirado',
      );

      expect(authUserId).toBeNull();
    });
  });

  describe('atualizarSenha', () => {
    it('retorna true quando a senha é atualizada com sucesso', async () => {
      cliente.auth.admin.updateUserById.mockResolvedValue({ data: {}, error: null });

      const sucesso = await gateway.atualizarSenha(
        '11111111-1111-1111-1111-111111111111',
        'nova-senha-123',
      );

      expect(sucesso).toBe(true);
      expect(cliente.auth.admin.updateUserById).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        { password: 'nova-senha-123' },
      );
    });

    it('retorna false quando o GoTrue recusa a atualização', async () => {
      cliente.auth.admin.updateUserById.mockResolvedValue({
        data: {},
        error: { message: 'Unable to update user' },
      });

      const sucesso = await gateway.atualizarSenha('11111111-1111-1111-1111-111111111111', 'curta');

      expect(sucesso).toBe(false);
    });
  });

  describe('encerrarSessao', () => {
    it('revoga o access token junto ao GoTrue', async () => {
      cliente.auth.admin.signOut.mockResolvedValue({ error: null });

      await gateway.encerrarSessao('access-token');

      expect(cliente.auth.admin.signOut).toHaveBeenCalledWith('access-token');
    });
  });

  describe('criarUsuario', () => {
    it('retorna o authUserId quando o GoTrue cria o usuário com sucesso', async () => {
      cliente.auth.admin.createUser.mockResolvedValue({
        data: { user: usuarioFalso },
        error: null,
      });

      const authUserId = await gateway.criarUsuario('maria@montacontrol.local', 'senha-longa-123');

      expect(authUserId).toBe('11111111-1111-1111-1111-111111111111');
      expect(cliente.auth.admin.createUser).toHaveBeenCalledWith({
        email: 'maria@montacontrol.local',
        password: 'senha-longa-123',
        email_confirm: true,
      });
    });

    it('retorna null quando o e-mail já está cadastrado no GoTrue', async () => {
      cliente.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email address already registered' },
      });

      const authUserId = await gateway.criarUsuario('maria@montacontrol.local', 'senha-longa-123');

      expect(authUserId).toBeNull();
    });
  });

  describe('excluirUsuario', () => {
    it('remove o usuário do GoTrue', async () => {
      cliente.auth.admin.deleteUser.mockResolvedValue({ error: null });

      await gateway.excluirUsuario('11111111-1111-1111-1111-111111111111');

      expect(cliente.auth.admin.deleteUser).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
      );
    });
  });
});
