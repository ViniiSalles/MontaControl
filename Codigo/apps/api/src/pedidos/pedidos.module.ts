import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PedidosController } from './pedidos.controller';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [PrismaModule],
  controllers: [PedidosController],
  providers: [PedidosService, PedidosRepository],
  // A validação de distância tolerada da jornada, e a triagem de peças,
  // precisam do repositório.
  exports: [PedidosRepository],
})
export class PedidosModule {}
