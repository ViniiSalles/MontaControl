import {
  BadGatewayException,
  ConflictException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Perfil, StatusAtestado } from '../../generated/prisma';
import { SupabaseStorageGateway } from '../supabase/supabase-storage.gateway';
import { AtestadosRepository } from './atestados.repository';
import { AtestadosService } from './atestados.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const UM_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function corpoEnvio(sobrescritas: Record<string, unknown> = {}) {
  return {
    idCliente: '11111111-1111-1111-1111-111111111111',
    dataInicio: '2026-09-01',
    dataFim: '2026-09-03',
    fotos: [{ conteudoBase64: UM_PIXEL_PNG_BASE64, mimeType: 'image/png' as const }],
    ...sobrescritas,
  };
}

const atestadoPendente = {
  id: 5,
  usuarioId: 7,
  usuarioNome: 'Montador Um',
  dataInicio: '2026-09-01',
  dataFim: '2026-09-03',
  observacao: null,
  status: StatusAtestado.PENDENTE,
  motivoRejeicao: null,
  validadoPor: null,
  validadoEm: null,
  criadoEm: '2026-09-01T12:00:00.000Z',
};

describe('AtestadosService', () => {
  let repository: {
    criar: jest.Mock;
    buscarPorIdCliente: jest.Mock;
    buscarPorId: jest.Mock;
    listarPorStatus: jest.Mock;
    listarAnalisados: jest.Mock;
    listarPorUsuario: jest.Mock;
    analisar: jest.Mock;
  };
  let storage: { enviar: jest.Mock; gerarUrlAssinada: jest.Mock; remover: jest.Mock };
  let notificacoes: { notificar: jest.Mock };
  let service: AtestadosService;

  beforeEach(() => {
    repository = {
      criar: jest.fn(),
      buscarPorIdCliente: jest.fn().mockResolvedValue(null),
      buscarPorId: jest.fn(),
      listarPorStatus: jest.fn(),
      listarAnalisados: jest.fn(),
      listarPorUsuario: jest.fn(),
      analisar: jest.fn(),
    };
    storage = {
      enviar: jest.fn().mockResolvedValue(true),
      gerarUrlAssinada: jest.fn().mockResolvedValue('https://storage.local/assinada'),
      remover: jest.fn(),
    };
    // As falhas simuladas de notificar são logadas pelo service; sem ruído no output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    notificacoes = { notificar: jest.fn().mockResolvedValue(undefined) };
    service = new AtestadosService(
      repository as unknown as AtestadosRepository,
      storage as unknown as SupabaseStorageGateway,
      notificacoes as unknown as NotificacoesService,
    );
  });

  describe('enviar', () => {
    it('sobe a foto e cria o atestado PENDENTE', async () => {
      repository.criar.mockResolvedValue(atestadoPendente);

      const resultado = await service.enviar(7, corpoEnvio());

      expect(resultado).toEqual(atestadoPendente);
      expect(storage.enviar).toHaveBeenCalledTimes(1);
      expect(repository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 7, dataInicio: '2026-09-01', dataFim: '2026-09-03' }),
      );
    });

    it('grava a observação aparada', async () => {
      repository.criar.mockResolvedValue({ ...atestadoPendente, observacao: 'Dor lombar' });

      await service.enviar(7, corpoEnvio({ observacao: '  Dor lombar  ' }));

      expect(repository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ observacao: 'Dor lombar' }),
      );
    });

    it('trata observação vazia ou só espaços como ausente', async () => {
      repository.criar.mockResolvedValue({ ...atestadoPendente, observacao: null });

      await service.enviar(7, corpoEnvio({ observacao: '   ' }));

      expect(repository.criar).toHaveBeenCalledWith(expect.objectContaining({ observacao: null }));
    });

    it('devolve o atestado existente no reenvio do mesmo idCliente, sem novo upload', async () => {
      repository.buscarPorIdCliente.mockResolvedValue(atestadoPendente);

      const resultado = await service.enviar(7, corpoEnvio());

      expect(resultado).toEqual(atestadoPendente);
      expect(storage.enviar).not.toHaveBeenCalled();
      expect(repository.criar).not.toHaveBeenCalled();
    });

    it('recusa período invertido', async () => {
      await expect(
        service.enviar(7, corpoEnvio({ dataInicio: '2026-09-05', dataFim: '2026-09-01' })),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repository.criar).not.toHaveBeenCalled();
    });

    it('recusa atestado sem foto', async () => {
      await expect(service.enviar(7, corpoEnvio({ fotos: [] }))).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('recusa foto acima do limite de 5 MB', async () => {
      const gigante = 'A'.repeat(8 * 1024 * 1024);

      await expect(
        service.enviar(7, corpoEnvio({ fotos: [{ conteudoBase64: gigante, mimeType: 'image/png' }] })),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(storage.enviar).not.toHaveBeenCalled();
    });

    it('não cria a linha quando o Storage recusa o upload', async () => {
      storage.enviar.mockResolvedValue(false);

      await expect(service.enviar(7, corpoEnvio())).rejects.toThrow(BadGatewayException);
      expect(repository.criar).not.toHaveBeenCalled();
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('enviar atestado notifica RHs', async () => {
      repository.criar.mockResolvedValue(atestadoPendente);

      await service.enviar(7, corpoEnvio());

      expect(notificacoes.notificar).toHaveBeenCalledTimes(1);
      expect(notificacoes.notificar).toHaveBeenCalledWith({
        perfis: [Perfil.RH],
        tipo: 'ATESTADO_ENVIADO',
        titulo: 'Atestado recebido',
        mensagem: expect.stringContaining('Montador Um'),
        referencia: { tipo: 'ATESTADO', id: 5 },
        chaveOrigem: 'atestado:5:enviado',
      });
    });

    it('enviar idempotente (jaCriado) não notifica', async () => {
      repository.buscarPorIdCliente.mockResolvedValue(atestadoPendente);

      await service.enviar(7, corpoEnvio());

      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('falha de notificar não faz a operação lançar', async () => {
      repository.criar.mockResolvedValue(atestadoPendente);
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.enviar(7, corpoEnvio())).resolves.toEqual(atestadoPendente);
    });
  });

  describe('validar', () => {
    it('marca VALIDADO e registra quem analisou', async () => {
      repository.buscarPorId.mockResolvedValue({ ...atestadoPendente, fotos: [] });
      repository.analisar.mockResolvedValue({
        ...atestadoPendente,
        status: StatusAtestado.VALIDADO,
        validadoPor: 2,
      });

      const resultado = await service.validar(5, 2);

      expect(resultado.status).toBe(StatusAtestado.VALIDADO);
      expect(repository.analisar).toHaveBeenCalledWith(5, {
        status: StatusAtestado.VALIDADO,
        analistaId: 2,
        motivoRejeicao: null,
      });
    });

    it('recusa analisar duas vezes', async () => {
      repository.buscarPorId.mockResolvedValue({
        ...atestadoPendente,
        status: StatusAtestado.VALIDADO,
        fotos: [],
      });

      await expect(service.validar(5, 2)).rejects.toThrow(ConflictException);
      expect(repository.analisar).not.toHaveBeenCalled();
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });
  });

  describe('notificações da análise', () => {
    it('validar/rejeitar notifica o montador', async () => {
      repository.buscarPorId.mockResolvedValue({ ...atestadoPendente, fotos: [] });
      repository.analisar.mockResolvedValueOnce({
        ...atestadoPendente,
        status: StatusAtestado.VALIDADO,
      });

      await service.validar(5, 2);

      expect(notificacoes.notificar).toHaveBeenLastCalledWith({
        usuarioIds: [7],
        tipo: 'ATESTADO_VALIDADO',
        titulo: 'Atestado validado',
        mensagem: expect.any(String),
        referencia: { tipo: 'ATESTADO', id: 5 },
        chaveOrigem: 'atestado:5:validado',
      });

      repository.analisar.mockResolvedValueOnce({
        ...atestadoPendente,
        status: StatusAtestado.REJEITADO,
        motivoRejeicao: 'Documento ilegível',
      });

      await service.rejeitar(5, 2, '  Documento ilegível  ');

      expect(notificacoes.notificar).toHaveBeenCalledTimes(2);
      expect(notificacoes.notificar).toHaveBeenLastCalledWith({
        usuarioIds: [7],
        tipo: 'ATESTADO_REJEITADO',
        titulo: 'Atestado rejeitado',
        mensagem: expect.stringContaining('Documento ilegível'),
        referencia: { tipo: 'ATESTADO', id: 5 },
        chaveOrigem: 'atestado:5:rejeitado',
      });
    });

    it('rejeitar com motivo em branco não notifica', async () => {
      repository.buscarPorId.mockResolvedValue({ ...atestadoPendente, fotos: [] });

      await expect(service.rejeitar(5, 2, '   ')).rejects.toThrow(UnprocessableEntityException);
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('validar: falha de notificar não faz a operação lançar', async () => {
      const validado = { ...atestadoPendente, status: StatusAtestado.VALIDADO };
      repository.buscarPorId.mockResolvedValue({ ...atestadoPendente, fotos: [] });
      repository.analisar.mockResolvedValue(validado);
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.validar(5, 2)).resolves.toEqual(validado);
    });
  });

  describe('rejeitar', () => {
    it('marca REJEITADO com o motivo aparado', async () => {
      repository.buscarPorId.mockResolvedValue({ ...atestadoPendente, fotos: [] });
      repository.analisar.mockResolvedValue({
        ...atestadoPendente,
        status: StatusAtestado.REJEITADO,
        motivoRejeicao: 'Documento ilegível',
      });

      await service.rejeitar(5, 2, '  Documento ilegível  ');

      expect(repository.analisar).toHaveBeenCalledWith(5, {
        status: StatusAtestado.REJEITADO,
        analistaId: 2,
        motivoRejeicao: 'Documento ilegível',
      });
    });

    it('recusa motivo em branco', async () => {
      repository.buscarPorId.mockResolvedValue({ ...atestadoPendente, fotos: [] });

      await expect(service.rejeitar(5, 2, '   ')).rejects.toThrow(UnprocessableEntityException);
      expect(repository.analisar).not.toHaveBeenCalled();
    });
  });

  describe('listarHistorico', () => {
    it('delega ao repositório os atestados já analisados', async () => {
      const analisados = [
        { ...atestadoPendente, status: StatusAtestado.VALIDADO },
        { ...atestadoPendente, id: 6, status: StatusAtestado.REJEITADO, motivoRejeicao: 'Ilegível' },
      ];
      repository.listarAnalisados.mockResolvedValue(analisados);

      const resultado = await service.listarHistorico();

      expect(resultado).toEqual(analisados);
      expect(repository.listarAnalisados).toHaveBeenCalled();
    });
  });

  describe('detalhar', () => {
    it('troca o caminho do bucket por URL assinada', async () => {
      repository.buscarPorId.mockResolvedValue({
        ...atestadoPendente,
        fotos: [{ id: 1, storagePath: '7/5/foto.png' }],
      });

      const resultado = await service.detalhar(5);

      expect(storage.gerarUrlAssinada).toHaveBeenCalledWith('7/5/foto.png', 300);
      expect(resultado.fotos[0].url).toBe('https://storage.local/assinada');
      expect(JSON.stringify(resultado)).not.toContain('storagePath');
    });
  });
});
