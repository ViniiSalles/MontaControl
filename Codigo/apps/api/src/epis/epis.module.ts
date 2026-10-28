import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AlugueisEpiController } from './alugueis-epi.controller';
import { AlugueisEpiRepository } from './alugueis-epi.repository';
import { AlugueisEpiService } from './alugueis-epi.service';
import { TiposEpiController } from './tipos-epi.controller';
import { TiposEpiRepository } from './tipos-epi.repository';
import { TiposEpiService } from './tipos-epi.service';

@Module({
  imports: [PrismaModule, UsuariosModule],
  controllers: [TiposEpiController, AlugueisEpiController],
  providers: [TiposEpiService, TiposEpiRepository, AlugueisEpiService, AlugueisEpiRepository],
})
export class EpisModule {}
