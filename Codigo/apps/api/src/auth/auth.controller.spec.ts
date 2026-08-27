import { Perfil } from '../../generated/prisma';
import { AuthController } from './auth.controller';
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

describe('AuthController', () => {
  let auth: {
    login: jest.Mock;
    refresh: jest.Mock;
    solicitarRecuperacaoSenha: jest.Mock;
    redefinirSenha: jest.Mock;
    sair: jest.Mock;
  };
  let controller: AuthController;

  beforeEach(() => {
    auth = {
      login: jest.fn(),
      refresh: jest.fn(),
      solicitarRecuperacaoSenha: jest.fn(),
      redefinirSenha: jest.fn(),
      sair: jest.fn(),
    };
    controller = new AuthController(auth as unknown as AuthService);
  });

  describe('login — TI01', () => {
    it('mapeia a sessão e o usuário para o formato de LoginResponse', async () => {
      auth.login.mockResolvedValue({ sessao: sessaoValida, usuario: usuarioAtivo });

      const resposta = await controller.login({
        email: 'maria@montacontrol.local',
        senha: 'senha-correta',
      });

      expect(resposta).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        usuario: {
          id: 1,
          nome: 'Maria Montadora',
          email: 'maria@montacontrol.local',
          perfil: Perfil.MONTADOR,
          ativo: true,
        },
      });
      expect(auth.login).toHaveBeenCalledWith('maria@montacontrol.local', 'senha-correta');
    });
  });

  describe('refresh', () => {
    it('delega ao service e mapeia a nova sessão', async () => {
      auth.refresh.mockResolvedValue({ sessao: sessaoValida, usuario: usuarioAtivo });

      const resposta = await controller.refresh({ refreshToken: 'refresh-token' });

      expect(resposta.accessToken).toBe('access-token');
      expect(auth.refresh).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('recuperarSenha', () => {
    it('retorna sempre a mesma mensagem, independente do e-mail existir', async () => {
      const resposta = await controller.recuperarSenha({ email: 'qualquer@montacontrol.local' });

      expect(resposta).toEqual({
        message:
          'Se o e-mail informado existir em nossa base, um código de recuperação foi enviado.',
      });
      expect(auth.solicitarRecuperacaoSenha).toHaveBeenCalledWith('qualquer@montacontrol.local');
    });
  });

  describe('redefinirSenha', () => {
    it('delega ao service com email, token e nova senha', async () => {
      await controller.redefinirSenha({
        email: 'maria@montacontrol.local',
        token: 'otp-valido',
        novaSenha: 'nova-senha-123',
      });

      expect(auth.redefinirSenha).toHaveBeenCalledWith(
        'maria@montacontrol.local',
        'otp-valido',
        'nova-senha-123',
      );
    });
  });

  describe('me', () => {
    it('mapeia o usuário autenticado para UsuarioDTO', () => {
      const resposta = controller.me(usuarioAtivo);

      expect(resposta).toEqual({
        id: 1,
        nome: 'Maria Montadora',
        email: 'maria@montacontrol.local',
        perfil: Perfil.MONTADOR,
        ativo: true,
      });
    });
  });

  describe('sair', () => {
    it('extrai o access token do cabeçalho Authorization e revoga a sessão', async () => {
      await controller.sair('Bearer access-token');

      expect(auth.sair).toHaveBeenCalledWith('access-token');
    });
  });
});
