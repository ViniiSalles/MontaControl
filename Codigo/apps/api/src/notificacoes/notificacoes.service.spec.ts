import { Logger } from '@nestjs/common';
import type { NotificacaoDTO } from '@montacontrol/shared';
import { Perfil } from '../../generated/prisma';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { NotificacaoNaoEncontradaException } from './exceptions/notificacao-nao-encontrada.exception';
import type { EmissorNotificacao } from './notificacoes.emissor';
import { NotificacoesRepository } from './notificacoes.repository';
import { NotificacoesService } from './notificacoes.service';

function dto(id: number): NotificacaoDTO {
  return {
    id,
    tipo: 'AVARIA_REPORTADA',
    titulo: 'Avaria reportada',
    mensagem: 'Peça 12 chegou quebrada',
    referenciaTipo: 'AVARIA',
    referenciaId: 123,
    lida: false,
    criadaEm: '2026-10-27T12:00:00.000Z',
  };
}

const entradaBase = {
  tipo: 'AVARIA_REPORTADA' as const,
  titulo: 'Avaria reportada',
  mensagem: 'Peça 12 chegou quebrada',
  referencia: { tipo: 'AVARIA' as const, id: 123 },
  chaveOrigem: 'avaria:123:reportada',
};

describe('NotificacoesService', () => {
  let repo: {
    criarVarias: jest.Mock;
    listarDoUsuario: jest.Mock;
    contarNaoLidas: jest.Mock;
    marcarLida: jest.Mock;
    marcarTodasLidas: jest.Mock;
  };
  let usuarios: { listarIdsAtivos: jest.Mock };
  let emissor: { emitirParaUsuario: jest.Mock };
  let service: NotificacoesService;

  beforeEach(() => {
    repo = {
      criarVarias: jest.fn().mockResolvedValue([]),
      listarDoUsuario: jest.fn(),
      contarNaoLidas: jest.fn(),
      marcarLida: jest.fn(),
      marcarTodasLidas: jest.fn(),
    };
    usuarios = { listarIdsAtivos: jest.fn().mockResolvedValue([]) };
    emissor = { emitirParaUsuario: jest.fn() };
    service = new NotificacoesService(
      repo as unknown as NotificacoesRepository,
      usuarios as unknown as UsuariosRepository,
      emissor as unknown as EmissorNotificacao,
    );
  });

  describe('notificar', () => {
    it('resolve perfis e usuarioIds em ids ativos numa só consulta, sem duplicar', async () => {
      usuarios.listarIdsAtivos.mockResolvedValue([1, 2, 3, 9]);

      await service.notificar({
        ...entradaBase,
        perfis: [Perfil.RH, Perfil.DEPOSITO],
        usuarioIds: [3, 9, 9],
      });

      expect(usuarios.listarIdsAtivos).toHaveBeenCalledTimes(1);
      expect(usuarios.listarIdsAtivos).toHaveBeenCalledWith({
        perfis: [Perfil.RH, Perfil.DEPOSITO],
        ids: [3, 9],
      });
      const gravadas = repo.criarVarias.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(gravadas.map((g) => g.usuarioId).sort()).toEqual([1, 2, 3, 9]);
      expect(gravadas[0]).toEqual(
        expect.objectContaining({
          tipo: 'AVARIA_REPORTADA',
          titulo: 'Avaria reportada',
          mensagem: 'Peça 12 chegou quebrada',
          referenciaTipo: 'AVARIA',
          referenciaId: 123,
          chaveOrigem: 'avaria:123:reportada',
        }),
      );
    });

    it('destinatário inativo em usuarioIds não recebe e não emite', async () => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      // 5 está inativo: a consulta só devolve o 4.
      usuarios.listarIdsAtivos.mockResolvedValue([4]);
      repo.criarVarias.mockResolvedValue([{ usuarioId: 4, notificacao: dto(20) }]);

      await service.notificar({ ...entradaBase, usuarioIds: [4, 5] });

      expect(usuarios.listarIdsAtivos).toHaveBeenCalledWith({ perfis: [], ids: [4, 5] });
      const gravadas = repo.criarVarias.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(gravadas.map((g) => g.usuarioId)).toEqual([4]);
      expect(emissor.emitirParaUsuario).toHaveBeenCalledTimes(1);
      expect(emissor.emitirParaUsuario).not.toHaveBeenCalledWith(5, expect.anything());
      expect(aviso).toHaveBeenCalledWith(expect.stringContaining('5'));
      aviso.mockRestore();
    });

    it('nenhum usuarioId ativo: não grava nem emite', async () => {
      const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      usuarios.listarIdsAtivos.mockResolvedValue([]);

      await service.notificar({ ...entradaBase, usuarioIds: [5] });

      expect(repo.criarVarias).not.toHaveBeenCalled();
      expect(emissor.emitirParaUsuario).not.toHaveBeenCalled();
      aviso.mockRestore();
    });

    it('emite só as notificações realmente criadas', async () => {
      usuarios.listarIdsAtivos.mockResolvedValue([1, 2, 3]);
      // O banco descartou a do usuário 2 (chaveOrigem repetida).
      repo.criarVarias.mockResolvedValue([
        { usuarioId: 1, notificacao: dto(10) },
        { usuarioId: 3, notificacao: dto(11) },
      ]);

      await service.notificar({ ...entradaBase, usuarioIds: [1, 2, 3] });

      expect(emissor.emitirParaUsuario).toHaveBeenCalledTimes(2);
      expect(emissor.emitirParaUsuario).toHaveBeenCalledWith(1, dto(10));
      expect(emissor.emitirParaUsuario).toHaveBeenCalledWith(3, dto(11));
    });

    it('não notifica nem lança quando não há destinatários', async () => {
      usuarios.listarIdsAtivos.mockResolvedValue([]);

      await expect(
        service.notificar({ ...entradaBase, perfis: [Perfil.RH] }),
      ).resolves.toBeUndefined();

      expect(repo.criarVarias).not.toHaveBeenCalled();
      expect(emissor.emitirParaUsuario).not.toHaveBeenCalled();
    });

    it('engole e loga erro do repositório', async () => {
      const erroLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      usuarios.listarIdsAtivos.mockResolvedValue([1]);
      repo.criarVarias.mockRejectedValue(new Error('banco fora'));

      await expect(
        service.notificar({ ...entradaBase, usuarioIds: [1] }),
      ).resolves.toBeUndefined();

      expect(erroLog).toHaveBeenCalled();
      expect(emissor.emitirParaUsuario).not.toHaveBeenCalled();
      erroLog.mockRestore();
    });
  });

  describe('listar', () => {
    it('devolve itens, não lidas e cursor da próxima página', async () => {
      repo.listarDoUsuario.mockResolvedValue([dto(9), dto(8)]);
      repo.contarNaoLidas.mockResolvedValue(5);

      await expect(service.listar(3, 2)).resolves.toEqual({
        itens: [dto(9), dto(8)],
        naoLidas: 5,
        proximoCursor: 8,
      });
      expect(repo.listarDoUsuario).toHaveBeenCalledWith(3, 2, undefined);
    });

    it('cursor nulo quando a página não está cheia', async () => {
      repo.listarDoUsuario.mockResolvedValue([dto(9)]);
      repo.contarNaoLidas.mockResolvedValue(1);

      const lista = await service.listar(3, 20, 12);

      expect(lista.proximoCursor).toBeNull();
      expect(repo.listarDoUsuario).toHaveBeenCalledWith(3, 20, 12);
    });
  });

  describe('marcarLida', () => {
    it('marca a notificação do próprio usuário', async () => {
      repo.marcarLida.mockResolvedValue(true);

      await expect(service.marcarLida(7, 3)).resolves.toBeUndefined();
      expect(repo.marcarLida).toHaveBeenCalledWith(7, 3);
    });

    it('marcarLida lança 404 para notificação de outro usuário', async () => {
      repo.marcarLida.mockResolvedValue(false);

      await expect(service.marcarLida(7, 99)).rejects.toBeInstanceOf(
        NotificacaoNaoEncontradaException,
      );
    });
  });

  describe('marcarTodasLidas', () => {
    it('delega ao repositório', async () => {
      repo.marcarTodasLidas.mockResolvedValue(4);

      await expect(service.marcarTodasLidas(3)).resolves.toBeUndefined();
      expect(repo.marcarTodasLidas).toHaveBeenCalledWith(3);
    });
  });
});
