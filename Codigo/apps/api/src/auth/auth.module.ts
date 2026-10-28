import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';
import { VerificadorTokenService } from './verificador-token.service';

@Module({
  imports: [SupabaseModule, UsuariosModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    VerificadorTokenService,
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  // O gateway de notificações autentica o handshake com o mesmo verificador.
  exports: [AuthService, VerificadorTokenService],
})
export class AuthModule {}
