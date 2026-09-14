import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PedidosRepository } from './pedidos.repository';

@Module({
  imports: [PrismaModule],
  providers: [PedidosRepository],
  // A validação de distância tolerada da jornada precisa das coordenadas
  // do cliente do pedido.
  exports: [PedidosRepository],
})
export class PedidosModule {}
