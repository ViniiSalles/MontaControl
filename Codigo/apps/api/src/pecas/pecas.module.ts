import { Module } from '@nestjs/common';
import { AmbientesModule } from '../ambientes/ambientes.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PecasController } from './pecas.controller';
import { PecasRepository } from './pecas.repository';
import { PecasService } from './pecas.service';

@Module({
  imports: [PrismaModule, AmbientesModule, PedidosModule],
  controllers: [PecasController],
  providers: [PecasService, PecasRepository],
  // O reporte de avaria precisa saber a qual pedido a peça pertence.
  exports: [PecasRepository],
})
export class PecasModule {}
