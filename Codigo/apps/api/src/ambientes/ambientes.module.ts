import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AmbientesRepository } from './ambientes.repository';

@Module({
  imports: [PrismaModule],
  providers: [AmbientesRepository],
  exports: [AmbientesRepository],
})
export class AmbientesModule {}
