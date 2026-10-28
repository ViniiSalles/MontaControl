import { Logger } from '@nestjs/common';
import { WS_EVENTS, type NotificacaoDTO } from '@montacontrol/shared';
import type { Server, Socket } from 'socket.io';
import { Perfil } from '../../generated/prisma';
import { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { VerificadorTokenService } from '../auth/verificador-token.service';
import { TokenInvalidoException } from '../common/exceptions/token-invalido.exception';
import { EmissorNotificacao } from './notificacoes.emissor';
import { NotificacoesGateway, resolverOrigemCors } from './notificacoes.gateway';

// `jose` é ESM-only e o Jest unitário não o transforma; o verificador é um duplo aqui.
jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(), jwtVerify: jest.fn() }));

type Middleware = (socket: Socket, next: (erro?: Error) => void) => Promise<void> | void;

const USUARIO: UsuarioAutenticado = {
  id: 7,
  nome: 'Gestor Teste',
  email: 'gestor@montacontrol.local',
  perfil: Perfil.GESTOR,
  ativo: true,
  authUserId: '77777777-7777-7777-7777-777777777777',
};

const NOTIFICACAO: NotificacaoDTO = {
  id: 1,
  tipo: 'AVARIA_REPORTADA',
  titulo: 'Avaria reportada',
  mensagem: 'Peça 123 com avaria',
  referenciaTipo: 'AVARIA',
  referenciaId: 10,
  lida: false,
  criadaEm: '2026-10-27T12:00:00.000Z',
};

interface SocketFalso {
  handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
  data: { user?: UsuarioAutenticado };
  join: jest.Mock;
  disconnect: jest.Mock;
}

function criarSocket(
  auth: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): SocketFalso {
  return { handshake: { auth, headers }, data: {}, join: jest.fn(), disconnect: jest.fn() };
}

describe('NotificacoesGateway', () => {
  let gateway: NotificacoesGateway;
  let verificador: { verificar: jest.Mock };
  let middleware: Middleware;
  let emit: jest.Mock;
  let to: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    verificador = { verificar: jest.fn() };
    gateway = new NotificacoesGateway(verificador as unknown as VerificadorTokenService);

    emit = jest.fn();
    to = jest.fn(() => ({ emit }));
    const server = {
      use: jest.fn((fn: Middleware) => {
        middleware = fn;
      }),
      to,
    };
    gateway.server = server as unknown as Server;
    gateway.afterInit(server as unknown as Server);
  });

  afterEach(() => jest.restoreAllMocks());

  async function handshake(socket: SocketFalso): Promise<jest.Mock> {
    const next = jest.fn();
    await middleware(socket as unknown as Socket, next);
    return next;
  }

  it('implementa a porta EmissorNotificacao usada pelo service', () => {
    expect(gateway).toBeInstanceOf(EmissorNotificacao);
  });

  it('recusa conexão sem token', async () => {
    const socket = criarSocket();

    const next = await handshake(socket);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'credenciais inválidas' }),
    );
    expect(verificador.verificar).not.toHaveBeenCalled();
    expect(socket.data.user).toBeUndefined();
  });

  it('recusa token inválido', async () => {
    verificador.verificar.mockRejectedValue(
      new TokenInvalidoException('Token inválido ou expirado'),
    );
    const socket = criarSocket({ token: 'nao-e-um-jwt' });

    const next = await handshake(socket);

    expect(verificador.verificar).toHaveBeenCalledWith('nao-e-um-jwt');
    // Mensagem genérica: não revela qual etapa (assinatura, usuário inativo...) falhou.
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'credenciais inválidas' }),
    );
    expect(socket.data.user).toBeUndefined();
  });

  it('recusa usuário inativo com a mesma mensagem genérica', async () => {
    verificador.verificar.mockRejectedValue(
      new TokenInvalidoException('Usuário inválido ou inativo'),
    );

    const next = await handshake(criarSocket({ token: 'token-usuario-inativo' }));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'credenciais inválidas' }),
    );
  });

  it('recusa com mensagem genérica quando a verificação falha por erro inesperado', async () => {
    verificador.verificar.mockRejectedValue(new Error('banco fora do ar'));

    const next = await handshake(criarSocket({ token: 'token' }));

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'credenciais inválidas' }),
    );
  });

  it('aceita o token no cabeçalho Authorization: Bearer', async () => {
    verificador.verificar.mockResolvedValue(USUARIO);
    const socket = criarSocket({}, { authorization: 'Bearer token-do-cabecalho' });

    const next = await handshake(socket);

    expect(verificador.verificar).toHaveBeenCalledWith('token-do-cabecalho');
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual(USUARIO);
  });

  it('entra na sala usuario:{id}', async () => {
    verificador.verificar.mockResolvedValue(USUARIO);
    const socket = criarSocket({ token: 'token-valido' });

    const next = await handshake(socket);
    await gateway.handleConnection(socket as unknown as Socket);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual(USUARIO);
    expect(socket.join).toHaveBeenCalledWith('usuario:7');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('derruba conexão que chegou sem usuário autenticado', async () => {
    const socket = criarSocket();

    await gateway.handleConnection(socket as unknown as Socket);

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('emitirParaUsuario envia notificacao:nova só à sala do destinatário', () => {
    gateway.emitirParaUsuario(7, NOTIFICACAO);

    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith('usuario:7');
    expect(emit).toHaveBeenCalledWith(WS_EVENTS.NOTIFICACAO_NOVA, NOTIFICACAO);
  });

  it('emitirParaUsuario não propaga falha do emit (um destinatário não afeta os outros)', () => {
    emit.mockImplementationOnce(() => {
      throw new Error('falha no socket');
    });

    expect(() => gateway.emitirParaUsuario(7, NOTIFICACAO)).not.toThrow();
    gateway.emitirParaUsuario(8, NOTIFICACAO);

    expect(to).toHaveBeenLastCalledWith('usuario:8');
    expect(emit).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});

describe('resolverOrigemCors', () => {
  const original = process.env.WS_CORS_ORIGENS;

  afterEach(() => {
    if (original === undefined) delete process.env.WS_CORS_ORIGENS;
    else process.env.WS_CORS_ORIGENS = original;
  });

  function resolver(origem: string | undefined): unknown {
    const callback = jest.fn();
    resolverOrigemCors(origem, callback);
    return callback.mock.calls[0][1];
  }

  it('sem WS_CORS_ORIGENS não libera nenhuma origem', () => {
    delete process.env.WS_CORS_ORIGENS;

    expect(resolver('https://app.montacontrol.com.br')).toBe(false);
  });

  it('libera só as origens listadas em WS_CORS_ORIGENS', () => {
    process.env.WS_CORS_ORIGENS = 'https://app.montacontrol.com.br, http://localhost:5173';

    expect(resolver('https://app.montacontrol.com.br')).toBe('https://app.montacontrol.com.br');
    expect(resolver('http://localhost:5173')).toBe('http://localhost:5173');
    expect(resolver('https://malicioso.example.com')).toBe(false);
    expect(resolver(undefined)).toBe(false);
  });
});
