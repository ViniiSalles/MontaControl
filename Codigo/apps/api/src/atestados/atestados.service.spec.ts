import { BadGatewayException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { StatusAtestado } from '../../generated/prisma';
import { SupabaseStorageGateway } from '../supabase/supabase-storage.gateway';
import { AtestadosRepository } from './atestados.repository';
import { AtestadosService } from './atestados.service';

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
    listarPorUsuario: jest.Mock;
    analisar: jest.Mock;
  };
  let storage: { enviar: jest.Mock; gerarUrlAssinada: jest.Mock; remover: jest.Mock };
  let service: AtestadosService;

  beforeEach(() => {
    repository = {
      criar: jest.fn(),
      buscarPorIdCliente: jest.fn().mockResolvedValue(null),
      buscarPorId: jest.fn(),
      listarPorStatus: jest.fn(),
      listarPorUsuario: jest.fn(),
      analisar: jest.fn(),
    };
    storage = {
      enviar: jest.fn().mockResolvedValue(true),
      gerarUrlAssinada: jest.fn().mockResolvedValue('https://storage.local/assinada'),
      remover: jest.fn(),
    };
    service = new AtestadosService(
      repository as unknown as AtestadosRepository,
      storage as unknown as SupabaseStorageGateway,
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
