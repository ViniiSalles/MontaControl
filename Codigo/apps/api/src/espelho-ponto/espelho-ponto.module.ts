import { Module } from '@nestjs/common';
import { BancoHorasModule } from '../banco-horas/banco-horas.module';
import { JornadasModule } from '../jornadas/jornadas.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EspelhoPontoController } from './espelho-ponto.controller';
import { EspelhoPontoService } from './espelho-ponto.service';

@Module({
  imports: [PrismaModule, JornadasModule, BancoHorasModule, UsuariosModule],
  controllers: [EspelhoPontoController],
  providers: [EspelhoPontoService],
})
export class EspelhoPontoModule {}
