import { Module } from '@nestjs/common';
import { AtestadosModule } from '../atestados/atestados.module';
import { JornadasModule } from '../jornadas/jornadas.module';
import { PontosEmAtrasoModule } from '../pontos-em-atraso/pontos-em-atraso.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { BancoHorasController } from './banco-horas.controller';
import { BancoHorasRepository } from './banco-horas.repository';
import { BancoHorasService } from './banco-horas.service';

@Module({
  imports: [PrismaModule, JornadasModule, AtestadosModule, PontosEmAtrasoModule, UsuariosModule],
  controllers: [BancoHorasController],
  providers: [BancoHorasService, BancoHorasRepository],
  // O pull de sincronização lê o saldo mensal gravado e recalcula o do mês corrente.
  exports: [BancoHorasRepository, BancoHorasService],
})
export class BancoHorasModule {}
