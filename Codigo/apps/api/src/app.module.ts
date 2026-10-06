import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AfdModule } from './afd/afd.module';
import { AtestadosModule } from './atestados/atestados.module';
import { AvariasModule } from './avarias/avarias.module';
import { AuthModule } from './auth/auth.module';
import { BancoHorasModule } from './banco-horas/banco-horas.module';
import { ClientesModule } from './clientes/clientes.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HealthController } from './common/health.controller';
import { validate } from './config/env.validation';
import { EquipesModule } from './equipes/equipes.module';
import { EspelhoPontoModule } from './espelho-ponto/espelho-ponto.module';
import { JornadasModule } from './jornadas/jornadas.module';
import { PecasModule } from './pecas/pecas.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PontosEmAtrasoModule } from './pontos-em-atraso/pontos-em-atraso.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    JornadasModule,
    PontosEmAtrasoModule,
    AtestadosModule,
    BancoHorasModule,
    EspelhoPontoModule,
    AfdModule,
    ClientesModule,
    PedidosModule,
    PecasModule,
    AvariasModule,
    EquipesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
