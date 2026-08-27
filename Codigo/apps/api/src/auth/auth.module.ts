import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseJwtGuard } from './guards/supabase-jwt.guard';

@Module({
  imports: [SupabaseModule, UsuariosModule],
  providers: [AuthService, SupabaseJwtGuard, RolesGuard],
  exports: [AuthService, SupabaseJwtGuard, RolesGuard],
})
export class AuthModule {}
