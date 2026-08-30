import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JornadasController } from './jornadas.controller';
import { JornadasRepository } from './jornadas.repository';
import { JornadasService } from './jornadas.service';

@Module({
  imports: [PrismaModule],
  controllers: [JornadasController],
  providers: [JornadasService, JornadasRepository],
  // O módulo de pontos em atraso materializa jornadas na aprovação e o de
  // sync lê jornadas para o pull — os dois precisam do repositório.
  exports: [JornadasRepository],
})
export class JornadasModule {}
