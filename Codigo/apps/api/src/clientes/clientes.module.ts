import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientesController } from './clientes.controller';
import { ClientesRepository } from './clientes.repository';
import { ClientesService } from './clientes.service';
import { GeocodificacaoGateway } from './geocodificacao.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [ClientesController],
  providers: [ClientesRepository, ClientesService, GeocodificacaoGateway],
  // `PedidosService` valida o cliente informado no cadastro do pedido.
  exports: [ClientesRepository],
})
export class ClientesModule {}
