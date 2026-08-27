import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';

@Module({
  imports: [SupabaseModule, UsuariosModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseJwtGuard, RolesGuard],
  exports: [AuthService, SupabaseJwtGuard, RolesGuard],
})
export class AuthModule {}
