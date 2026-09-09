import { Module } from '@nestjs/common';
import { AtestadosModule } from '../atestados/atestados.module';
import { JornadasModule } from '../jornadas/jornadas.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { EspelhoPontoController } from './espelho-ponto.controller';
import { EspelhoPontoService } from './espelho-ponto.service';

@Module({
  imports: [JornadasModule, AtestadosModule, UsuariosModule],
  controllers: [EspelhoPontoController],
  providers: [EspelhoPontoService],
})
export class EspelhoPontoModule {}
