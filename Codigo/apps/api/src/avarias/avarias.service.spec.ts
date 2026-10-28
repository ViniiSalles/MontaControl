import {
  BadGatewayException,
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Perfil, StatusAvaria } from '../../generated/prisma';
import type { UsuarioAutenticado } from '../auth/usuario-autenticado';
import { PecasRepository } from '../pecas/pecas.repository';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { AvariasStorageGateway } from '../supabase/avarias-storage.gateway';
import { AvariasRepository } from './avarias.repository';
import { AvariasService } from './avarias.service';
import { TiposAvariaRepository } from './tipos-avaria.repository';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const UM_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function usuario(perfil: Perfil, id = 7): UsuarioAutenticado {
  return { id, nome: 'Fulano', email: 'f@x.com', perfil, ativo: true, authUserId: 'uuid' };
}

function corpoReporte(sobrescritas: Record<string, unknown> = {}) {
  return {
    idCliente: '11111111-1111-1111-1111-111111111111',
    pecaId: 10,
    tipoAvariaId: 2,
    descricao: 'Porta chegou riscada',
    ...sobrescritas,
  };
}

const avariaReportada = {
  id: 3,
  pecaId: 10,
  descricaoPeca: 'Porta',
  codigoBarras: '789',
  pedidoId: 1,
  numeroPedido: 'PED-000001',
  ambiente: 'Cozinha',
  tipoAvariaId: 2,
  tipoAvaria: 'Risco',
  descricao: 'Porta chegou riscada',
  status: StatusAvaria.REPORTADA,
  registradaPor: 7,
  registradaPorNome: 'Fulano',
  registradaPorPerfil: Perfil.DEPOSITO,
  analisadaPor: null,
  analisadaEm: null,
  parecer: null,
  quantidadeFotos: 0,
  criadoEm: '2026-10-05T12:00:00.000Z',
  analisadaPorNome: null,
  fotos: [] as Array<{ id: number; storagePath: string }>,
};

describe('AvariasService', () => {
  let avarias: {
    criar: jest.Mock;
    buscarPorIdCliente: jest.Mock;
    buscarPorId: jest.Mock;
    listar: jest.Mock;
    listarPorRegistrador: jest.Mock;
    analisar: jest.Mock;
  };
  let tipos: { listar: jest.Mock; existe: jest.Mock };
  let pecas: { buscarPorId: jest.Mock };
  let pedidos: { montadorVinculado: jest.Mock };
  let storage: { enviar: jest.Mock; gerarUrlAssinada: jest.Mock; remover: jest.Mock };
  let notificacoes: { notificar: jest.Mock };
  let service: AvariasService;

  beforeEach(() => {
    avarias = {
      criar: jest.fn().mockResolvedValue(avariaReportada),
      buscarPorIdCliente: jest.fn().mockResolvedValue(null),
      buscarPorId: jest.fn(),
      listar: jest.fn(),
      listarPorRegistrador: jest.fn(),
      analisar: jest.fn(),
    };
    tipos = { listar: jest.fn(), existe: jest.fn().mockResolvedValue(true) };
    pecas = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 10, status: 'TRIADA', pedidoId: 1 }),
    };
    pedidos = { montadorVinculado: jest.fn().mockResolvedValue(true) };
    storage = {
      enviar: jest.fn().mockResolvedValue(true),
      gerarUrlAssinada: jest.fn().mockResolvedValue('https://storage.local/assinada'),
      remover: jest.fn(),
    };
    // As falhas simuladas de notificar são logadas pelo service; sem ruído no output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    notificacoes = { notificar: jest.fn().mockResolvedValue(undefined) };
    service = new AvariasService(
      avarias as unknown as AvariasRepository,
      tipos as unknown as TiposAvariaRepository,
      pecas as unknown as PecasRepository,
      pedidos as unknown as PedidosRepository,
      storage as unknown as AvariasStorageGateway,
      notificacoes as unknown as NotificacoesService,
    );
  });

  describe('reportar', () => {
    it('operador reporta qualquer peça, sem checar vínculo com o pedido', async () => {
      await service.reportar(usuario(Perfil.DEPOSITO), corpoReporte());

      expect(pedidos.montadorVinculado).not.toHaveBeenCalled();
      expect(avarias.criar).toHaveBeenCalledWith(
        expect.objectContaining({ pecaId: 10, registradaPor: 7, fotos: [] }),
      );
    });

    it('montador reporta peça de pedido em que está trabalhando', async () => {
      await service.reportar(usuario(Perfil.MONTADOR), corpoReporte());

      expect(pedidos.montadorVinculado).toHaveBeenCalledWith(1, 7);
      expect(avarias.criar).toHaveBeenCalled();
    });

    it('montador recebe 404 para peça de pedido alheio — não vaza que a peça existe', async () => {
      pedidos.montadorVinculado.mockResolvedValue(false);

      await expect(service.reportar(usuario(Perfil.MONTADOR), corpoReporte())).rejects.toThrow(
        NotFoundException,
      );
      expect(avarias.criar).not.toHaveBeenCalled();
    });

    it('peça inexistente é 404', async () => {
      pecas.buscarPorId.mockResolvedValue(null);

      await expect(service.reportar(usuario(Perfil.DEPOSITO), corpoReporte())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('idCliente repetido devolve a avaria já criada sem subir nada (idempotência da outbox)', async () => {
      avarias.buscarPorIdCliente.mockResolvedValue(avariaReportada);

      const resultado = await service.reportar(usuario(Perfil.MONTADOR), corpoReporte());

      expect(resultado).toBe(avariaReportada);
      expect(storage.enviar).not.toHaveBeenCalled();
      expect(avarias.criar).not.toHaveBeenCalled();
    });

    it('tipo de avaria inexistente é 422', async () => {
      tipos.existe.mockResolvedValue(false);

      await expect(service.reportar(usuario(Perfil.DEPOSITO), corpoReporte())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('sobe as fotos antes de gravar', async () => {
      const fotos = [{ conteudoBase64: UM_PIXEL_PNG_BASE64, mimeType: 'image/png' as const }];

      await service.reportar(usuario(Perfil.DEPOSITO), corpoReporte({ fotos }));

      expect(storage.enviar).toHaveBeenCalledTimes(1);
      expect(avarias.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          fotos: [expect.objectContaining({ mimeType: 'image/png', storagePath: expect.stringMatching(/^7\/.+\.png$/) })],
        }),
      );
    });

    it('falha no Storage remove as fotos já enviadas e não grava', async () => {
      storage.enviar.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const foto = { conteudoBase64: UM_PIXEL_PNG_BASE64, mimeType: 'image/png' as const };

      await expect(
        service.reportar(usuario(Perfil.DEPOSITO), corpoReporte({ fotos: [foto, foto] })),
      ).rejects.toThrow(BadGatewayException);
      expect(storage.remover).toHaveBeenCalledTimes(1);
      expect(avarias.criar).not.toHaveBeenCalled();
    });

    it('falha ao gravar remove as fotos do bucket', async () => {
      avarias.criar.mockRejectedValue(new Error('banco fora'));
      const foto = { conteudoBase64: UM_PIXEL_PNG_BASE64, mimeType: 'image/png' as const };

      await expect(
        service.reportar(usuario(Perfil.DEPOSITO), corpoReporte({ fotos: [foto] })),
      ).rejects.toThrow('banco fora');
      expect(storage.remover).toHaveBeenCalledTimes(1);
    });

    it('reportar notifica GESTORes com chaveOrigem avaria:{id}:reportada', async () => {
      await service.reportar(usuario(Perfil.DEPOSITO), corpoReporte());

      expect(notificacoes.notificar).toHaveBeenCalledTimes(1);
      expect(notificacoes.notificar).toHaveBeenCalledWith({
        perfis: [Perfil.GESTOR],
        tipo: 'AVARIA_REPORTADA',
        titulo: 'Avaria reportada',
        mensagem: expect.stringContaining('789'),
        referencia: { tipo: 'AVARIA', id: 3 },
        chaveOrigem: 'avaria:3:reportada',
      });
    });

    it('reportar idempotente (jaCriada) não notifica', async () => {
      avarias.buscarPorIdCliente.mockResolvedValue(avariaReportada);

      await service.reportar(usuario(Perfil.MONTADOR), corpoReporte());

      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('reportar com falha ao gravar não notifica', async () => {
      avarias.criar.mockRejectedValue(new Error('banco fora'));

      await expect(service.reportar(usuario(Perfil.DEPOSITO), corpoReporte())).rejects.toThrow(
        'banco fora',
      );
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('falha de notificar não faz a operação lançar', async () => {
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.reportar(usuario(Perfil.DEPOSITO), corpoReporte())).resolves.toBe(
        avariaReportada,
      );
    });
  });

  describe('atualizarStatus', () => {
    it('REPORTADA → EM_ANALISE dispensa parecer', async () => {
      avarias.buscarPorId.mockResolvedValue(avariaReportada);
      avarias.analisar.mockResolvedValue({ ...avariaReportada, status: StatusAvaria.EM_ANALISE });

      await service.atualizarStatus(3, 99, StatusAvaria.EM_ANALISE);

      expect(avarias.analisar).toHaveBeenCalledWith(3, {
        de: StatusAvaria.REPORTADA,
        para: StatusAvaria.EM_ANALISE,
        analistaId: 99,
        parecer: null,
      });
    });

    it('EM_ANALISE → RESOLVIDA grava o parecer aparado', async () => {
      avarias.buscarPorId.mockResolvedValue({ ...avariaReportada, status: StatusAvaria.EM_ANALISE });
      avarias.analisar.mockResolvedValue({ ...avariaReportada, status: StatusAvaria.RESOLVIDA });

      await service.atualizarStatus(3, 99, StatusAvaria.RESOLVIDA, '  Peça aproveitada  ');

      expect(avarias.analisar).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ para: StatusAvaria.RESOLVIDA, parecer: 'Peça aproveitada' }),
      );
    });

    it.each([StatusAvaria.REPOSICAO_SOLICITADA, StatusAvaria.RESOLVIDA])(
      '%s sem parecer é 422',
      async (para) => {
        avarias.buscarPorId.mockResolvedValue({
          ...avariaReportada,
          status: StatusAvaria.EM_ANALISE,
        });

        await expect(service.atualizarStatus(3, 99, para, '   ')).rejects.toThrow(
          UnprocessableEntityException,
        );
        expect(avarias.analisar).not.toHaveBeenCalled();
      },
    );

    it.each([
      [StatusAvaria.REPORTADA, StatusAvaria.RESOLVIDA],
      [StatusAvaria.REPORTADA, StatusAvaria.REPOSICAO_SOLICITADA],
      [StatusAvaria.RESOLVIDA, StatusAvaria.EM_ANALISE],
      [StatusAvaria.REPOSICAO_SOLICITADA, StatusAvaria.EM_ANALISE],
      [StatusAvaria.EM_ANALISE, StatusAvaria.REPORTADA],
    ])('%s → %s é transição inválida (409)', async (de, para) => {
      avarias.buscarPorId.mockResolvedValue({ ...avariaReportada, status: de });

      await expect(service.atualizarStatus(3, 99, para, 'parecer qualquer')).rejects.toThrow(
        ConflictException,
      );
    });

    it('perder a corrida para outro gestor é 409 e não notifica', async () => {
      avarias.buscarPorId.mockResolvedValue(avariaReportada);
      avarias.analisar.mockResolvedValue(null);

      await expect(service.atualizarStatus(3, 99, StatusAvaria.EM_ANALISE)).rejects.toThrow(
        ConflictException,
      );
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('atualizarStatus notifica quem registrou com avaria:{id}:{status}', async () => {
      avarias.buscarPorId.mockResolvedValue(avariaReportada);
      avarias.analisar.mockResolvedValue({ ...avariaReportada, status: StatusAvaria.EM_ANALISE });

      await service.atualizarStatus(3, 99, StatusAvaria.EM_ANALISE);

      expect(notificacoes.notificar).toHaveBeenCalledTimes(1);
      expect(notificacoes.notificar).toHaveBeenCalledWith({
        usuarioIds: [7],
        tipo: 'AVARIA_ATUALIZADA',
        titulo: 'Atualização da avaria',
        mensagem: expect.stringContaining('em análise'),
        referencia: { tipo: 'AVARIA', id: 3 },
        chaveOrigem: 'avaria:3:EM_ANALISE',
      });
    });

    it('atualizarStatus: falha de notificar não faz a operação lançar', async () => {
      avarias.buscarPorId.mockResolvedValue(avariaReportada);
      const atualizada = { ...avariaReportada, status: StatusAvaria.EM_ANALISE };
      avarias.analisar.mockResolvedValue(atualizada);
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.atualizarStatus(3, 99, StatusAvaria.EM_ANALISE)).resolves.toBe(
        atualizada,
      );
    });

    it('avaria inexistente é 404', async () => {
      avarias.buscarPorId.mockResolvedValue(null);

      await expect(service.atualizarStatus(3, 99, StatusAvaria.EM_ANALISE)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('detalhar', () => {
    it('troca o caminho do bucket por URL assinada', async () => {
      avarias.buscarPorId.mockResolvedValue({
        ...avariaReportada,
        fotos: [{ id: 1, storagePath: '7/abc.png' }],
      });

      const detalhe = await service.detalhar(3);

      expect(detalhe.fotos).toEqual([
        { id: 1, url: 'https://storage.local/assinada', expiraEm: expect.any(String) },
      ]);
      expect(JSON.stringify(detalhe)).not.toContain('7/abc.png');
    });
  });
});
