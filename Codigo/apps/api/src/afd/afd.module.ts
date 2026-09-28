import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AfdController } from './afd.controller';
import { AfdService } from './afd.service';
import { MarcacoesRepository } from './marcacoes.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AfdController],
  providers: [AfdService, MarcacoesRepository],
})
export class AfdModule {}
