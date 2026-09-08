import { Module } from '@nestjs/common';
import { JornadasModule } from '../jornadas/jornadas.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BancoHorasController } from './banco-horas.controller';
import { BancoHorasRepository } from './banco-horas.repository';
import { BancoHorasService } from './banco-horas.service';

@Module({
  // `JornadasModule` entra pelo `JornadasRepository` que ele exporta: o
  // cálculo soma jornadas do período, e o Service não pode falar com o
  // Prisma direto.
  imports: [PrismaModule, JornadasModule],
  controllers: [BancoHorasController],
  providers: [BancoHorasService, BancoHorasRepository],
  // A issue #25 (espelho de ponto) usa o Service (não só o Repository)
  // porque precisa do saldo recalculado na hora, não do último valor salvo.
  exports: [BancoHorasRepository, BancoHorasService],
})
export class BancoHorasModule {}
