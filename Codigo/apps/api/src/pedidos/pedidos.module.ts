import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PedidosController } from './pedidos.controller';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [PrismaModule, ClientesModule],
  controllers: [PedidosController],
  providers: [PedidosRepository, PedidosService],
  // A validação de distância tolerada da jornada (coordenadas do cliente) e a
  // triagem de peças precisam do repositório.
  exports: [PedidosRepository, PedidosService],
})
export class PedidosModule {}
