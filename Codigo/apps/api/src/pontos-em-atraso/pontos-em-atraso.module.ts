import { Module } from '@nestjs/common';
import { JornadasModule } from '../jornadas/jornadas.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PontosEmAtrasoController } from './pontos-em-atraso.controller';
import { PontosEmAtrasoRepository } from './pontos-em-atraso.repository';
import { PontosEmAtrasoService } from './pontos-em-atraso.service';

@Module({
  // `JornadasModule` entra pelo `JornadasRepository` que ele exporta: a
  // checagem de sobreposição pergunta por jornadas, e o Service não pode
  // falar com o Prisma direto.
  imports: [PrismaModule, JornadasModule],
  controllers: [PontosEmAtrasoController],
  providers: [PontosEmAtrasoService, PontosEmAtrasoRepository],
  // O banco de horas conta compensações pendentes por montador no painel do RH.
  exports: [PontosEmAtrasoRepository],
})
export class PontosEmAtrasoModule {}
