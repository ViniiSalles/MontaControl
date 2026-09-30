import { ConflictException, NotFoundException } from '@nestjs/common';
import { StatusPeca, StatusPedido } from '../../generated/prisma';
import { AmbientesRepository } from '../ambientes/ambientes.repository';
import { PedidosRepository } from '../pedidos/pedidos.repository';
import { PecasRepository } from './pecas.repository';
import { PecasService } from './pecas.service';

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
  };
  let ambientes: { buscarOuCriar: jest.Mock };
  let pedidos: { buscarPorNumero: jest.Mock; marcarEmTriagem: jest.Mock };
  let service: PecasService;

  beforeEach(() => {
    pecas = {
      buscarPorCodigoBarras: jest.fn().mockResolvedValue(null),
      buscarPorId: jest.fn(),
      associarCodigoBarras: jest.fn(),
      criar: jest.fn(),
    };
    ambientes = { buscarOuCriar: jest.fn().mockResolvedValue({ id: 4, nome: 'Cozinha' }) };
    pedidos = {
      buscarPorNumero: jest.fn().mockResolvedValue(pedidoAguardando),
      marcarEmTriagem: jest.fn().mockResolvedValue(undefined),
    };
    service = new PecasService(
      pecas as unknown as PecasRepository,
      ambientes as unknown as AmbientesRepository,
      pedidos as unknown as PedidosRepository,
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
});
