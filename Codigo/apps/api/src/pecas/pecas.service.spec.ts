import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Perfil, StatusPeca, StatusPedido } from '../../generated/prisma';
import { AmbientesRepository } from '../ambientes/ambientes.repository';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { PecasRepository } from './pecas.repository';
import { PecasService } from './pecas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

const pedidoAguardando = { id: 3, numeroPedido: 'PED-001', status: StatusPedido.AGUARDANDO, clienteId: 1 };

const dadosTriagem = {
  codigoBarras: 'COD-123',
  descricao: 'Porta de armário',
  numeroPedido: 'PED-001',
  ambiente: 'Cozinha',
};

const pecaCriada = {
  id: 9,
  codigoBarras: 'COD-123',
  descricao: 'Porta de armário',
  status: StatusPeca.TRIADA,
  ambienteId: 4,
};

describe('PecasService', () => {
  let pecas: {
    buscarPorCodigoBarras: jest.Mock;
    buscarPorId: jest.Mock;
    associarCodigoBarras: jest.Mock;
    criar: jest.Mock;
    buscarParaConferencia: jest.Mock;
    registrarConferencia: jest.Mock;
  };
  let ambientes: { buscarOuCriar: jest.Mock };
  let pedidos: {
    buscarPorNumero: jest.Mock;
    marcarEmTriagem: jest.Mock;
    montadorVinculado: jest.Mock;
  };
  let notificacoes: { notificar: jest.Mock };
  let service: PecasService;

  beforeEach(() => {
    pecas = {
      buscarPorCodigoBarras: jest.fn().mockResolvedValue(null),
      buscarPorId: jest.fn(),
      associarCodigoBarras: jest.fn(),
      criar: jest.fn(),
      buscarParaConferencia: jest.fn().mockResolvedValue(null),
      registrarConferencia: jest.fn().mockResolvedValue(true),
    };
    ambientes = { buscarOuCriar: jest.fn().mockResolvedValue({ id: 4, nome: 'Cozinha' }) };
    pedidos = {
      buscarPorNumero: jest.fn().mockResolvedValue(pedidoAguardando),
      marcarEmTriagem: jest.fn().mockResolvedValue(undefined),
      montadorVinculado: jest.fn().mockResolvedValue(true),
    };
    // As falhas simuladas de notificar são logadas pelo service; sem ruído no output.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    notificacoes = { notificar: jest.fn().mockResolvedValue(undefined) };
    service = new PecasService(
      pecas as unknown as PecasRepository,
      ambientes as unknown as AmbientesRepository,
      pedidos as unknown as PedidosRepository,
      notificacoes as unknown as NotificacoesService,
    );
  });

  describe('triar', () => {
    it('cadastra a peça já triada e agrupa no ambiente do pedido', async () => {
      pecas.criar.mockResolvedValue(pecaCriada);

      const resultado = await service.triar(2, dadosTriagem);

      expect(resultado).toEqual(pecaCriada);
      expect(pedidos.buscarPorNumero).toHaveBeenCalledWith('PED-001');
      expect(ambientes.buscarOuCriar).toHaveBeenCalledWith(3, 'Cozinha');
      expect(pecas.criar).toHaveBeenCalledWith({
        ambienteId: 4,
        codigoBarras: 'COD-123',
        descricao: 'Porta de armário',
        triadaPor: 2,
      });
    });

    it('apara espaços do nome do ambiente antes de agrupar', async () => {
      pecas.criar.mockResolvedValue(pecaCriada);

      await service.triar(2, { ...dadosTriagem, ambiente: '  Cozinha  ' });

      expect(ambientes.buscarOuCriar).toHaveBeenCalledWith(3, 'Cozinha');
    });

    it('marca o pedido como EM_TRIAGEM na primeira peça', async () => {
      pecas.criar.mockResolvedValue(pecaCriada);

      await service.triar(2, dadosTriagem);

      expect(pedidos.marcarEmTriagem).toHaveBeenCalledWith(3);
    });

    it('recusa pedido inexistente sem tocar peças ou ambientes', async () => {
      pedidos.buscarPorNumero.mockResolvedValue(null);

      await expect(service.triar(2, dadosTriagem)).rejects.toThrow(NotFoundException);
      expect(ambientes.buscarOuCriar).not.toHaveBeenCalled();
      expect(pecas.criar).not.toHaveBeenCalled();
    });

    it('bloqueia código de barras já triado (N7T2)', async () => {
      pecas.buscarPorCodigoBarras.mockResolvedValue({ id: 99 });

      await expect(service.triar(2, dadosTriagem)).rejects.toThrow(ConflictException);
      expect(ambientes.buscarOuCriar).not.toHaveBeenCalled();
      expect(pecas.criar).not.toHaveBeenCalled();
    });

    it('bloqueia a corrida entre a checagem e o create (repositório devolve null)', async () => {
      pecas.criar.mockResolvedValue(null);

      await expect(service.triar(2, dadosTriagem)).rejects.toThrow(ConflictException);
    });
  });

  describe('associarCodigoBarras', () => {
    const pendente = { id: 9, status: StatusPeca.PENDENTE, pedidoId: 3 };

    it('associa o código à peça pendente e move o pedido para EM_TRIAGEM', async () => {
      pecas.buscarPorId.mockResolvedValue(pendente);
      pecas.associarCodigoBarras.mockResolvedValue(pecaCriada);

      const resultado = await service.associarCodigoBarras(2, 9, 'COD-123');

      expect(resultado).toEqual(pecaCriada);
      expect(pecas.associarCodigoBarras).toHaveBeenCalledWith(9, 'COD-123', 2);
      expect(pedidos.marcarEmTriagem).toHaveBeenCalledWith(3);
    });

    it('peça inexistente → 404', async () => {
      pecas.buscarPorId.mockResolvedValue(null);

      await expect(service.associarCodigoBarras(2, 9, 'COD-123')).rejects.toThrow(NotFoundException);
    });

    it('peça já triada → 409', async () => {
      pecas.buscarPorId.mockResolvedValue({ ...pendente, status: StatusPeca.TRIADA });

      await expect(service.associarCodigoBarras(2, 9, 'COD-123')).rejects.toThrow(ConflictException);
      expect(pecas.associarCodigoBarras).not.toHaveBeenCalled();
    });

    it('código de barras já usado por outra peça → 409 (N7T2)', async () => {
      pecas.buscarPorId.mockResolvedValue(pendente);
      pecas.buscarPorCodigoBarras.mockResolvedValue({ id: 99 });

      await expect(service.associarCodigoBarras(2, 9, 'COD-123')).rejects.toThrow(ConflictException);
      expect(pecas.associarCodigoBarras).not.toHaveBeenCalled();
    });

    it('corrida no update (repositório devolve null) → 409 e pedido intocado', async () => {
      pecas.buscarPorId.mockResolvedValue(pendente);
      pecas.associarCodigoBarras.mockResolvedValue(null);

      await expect(service.associarCodigoBarras(2, 9, 'COD-123')).rejects.toThrow(ConflictException);
      expect(pedidos.marcarEmTriagem).not.toHaveBeenCalled();
    });
  });

  describe('conferir', () => {
    const leitura = { pedidoId: 3, codigoBarras: 'COD-123' };

    it('N4T1: peça do pedido ativo fica DESCARREGADA e registra o montador', async () => {
      pecas.buscarParaConferencia.mockResolvedValue({ id: 9, status: StatusPeca.TRIADA, pedidoId: 3 });

      const resultado = await service.conferir(2, leitura);

      expect(resultado).toEqual({ resultado: 'CONFERIDA' });
      expect(pecas.registrarConferencia).toHaveBeenCalledWith(
        9,
        [StatusPeca.TRIADA, StatusPeca.CARREGADA, StatusPeca.INCONSISTENTE],
        StatusPeca.DESCARREGADA,
        2,
      );
    });

    it('é idempotente: reenvio da mesma leitura confere de novo sem erro', async () => {
      pecas.buscarParaConferencia.mockResolvedValue({ id: 9, status: StatusPeca.DESCARREGADA, pedidoId: 3 });
      pecas.registrarConferencia.mockResolvedValue(false);

      await expect(service.conferir(2, leitura)).resolves.toEqual({ resultado: 'CONFERIDA' });
    });

    it('N4T2: peça de outro pedido fica INCONSISTENTE, só se ainda estava em trânsito', async () => {
      pecas.buscarParaConferencia.mockResolvedValue({ id: 9, status: StatusPeca.TRIADA, pedidoId: 77 });

      const resultado = await service.conferir(2, leitura);

      expect(resultado).toEqual({ resultado: 'INCONSISTENTE' });
      expect(pecas.registrarConferencia).toHaveBeenCalledWith(
        9,
        [StatusPeca.TRIADA, StatusPeca.CARREGADA],
        StatusPeca.INCONSISTENTE,
        2,
      );
    });

    it('conferir INCONSISTENTE real notifica GESTORes e retorno repetido sem mudança não notifica', async () => {
      pecas.buscarParaConferencia.mockResolvedValue({ id: 9, status: StatusPeca.TRIADA, pedidoId: 77 });

      await expect(service.conferir(2, leitura)).resolves.toEqual({ resultado: 'INCONSISTENTE' });

      expect(notificacoes.notificar).toHaveBeenCalledTimes(1);
      expect(notificacoes.notificar).toHaveBeenCalledWith({
        perfis: [Perfil.GESTOR],
        tipo: 'PECA_INCONSISTENTE',
        titulo: 'Peça na obra errada',
        mensagem: expect.stringContaining('COD-123'),
        referencia: { tipo: 'PECA', id: 9 },
        chaveOrigem: 'peca:9:inconsistente',
      });

      // Reenvio da mesma leitura: a peça já estava INCONSISTENTE, nada mudou.
      notificacoes.notificar.mockClear();
      pecas.buscarParaConferencia.mockResolvedValue({
        id: 9,
        status: StatusPeca.INCONSISTENTE,
        pedidoId: 77,
      });
      pecas.registrarConferencia.mockResolvedValue(false);

      await expect(service.conferir(2, leitura)).resolves.toEqual({ resultado: 'INCONSISTENTE' });
      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('conferir CONFERIDA (pedido certo) não notifica', async () => {
      pecas.buscarParaConferencia.mockResolvedValue({ id: 9, status: StatusPeca.TRIADA, pedidoId: 3 });

      await service.conferir(2, leitura);

      expect(notificacoes.notificar).not.toHaveBeenCalled();
    });

    it('falha de notificar não faz a operação lançar', async () => {
      pecas.buscarParaConferencia.mockResolvedValue({ id: 9, status: StatusPeca.TRIADA, pedidoId: 77 });
      notificacoes.notificar.mockRejectedValue(new Error('socket fora'));

      await expect(service.conferir(2, leitura)).resolves.toEqual({ resultado: 'INCONSISTENTE' });
    });

    it('código sem peça triada não muda nada', async () => {
      await expect(service.conferir(2, leitura)).resolves.toEqual({ resultado: 'NAO_ENCONTRADA' });
      expect(pecas.registrarConferencia).not.toHaveBeenCalled();
    });

    it('pedido em que o montador não trabalha é 404', async () => {
      pedidos.montadorVinculado.mockResolvedValue(false);

      await expect(service.conferir(2, leitura)).rejects.toBeInstanceOf(NotFoundException);
      expect(pedidos.montadorVinculado).toHaveBeenCalledWith(3, 2);
      expect(pecas.buscarParaConferencia).not.toHaveBeenCalled();
    });
  });
});
