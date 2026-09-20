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
  let pecas: { buscarPorCodigoBarras: jest.Mock; criar: jest.Mock };
  let ambientes: { buscarOuCriar: jest.Mock };
  let pedidos: { buscarPorNumero: jest.Mock; marcarEmTriagem: jest.Mock };
  let service: PecasService;

  beforeEach(() => {
    pecas = { buscarPorCodigoBarras: jest.fn().mockResolvedValue(null), criar: jest.fn() };
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
});
