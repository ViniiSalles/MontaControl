import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { FotosUsuarios } from './fotos-usuarios';
import { UsuariosController } from './usuarios.controller';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [SupabaseModule],
  controllers: [UsuariosController],
  providers: [UsuariosRepository, UsuariosService, FotosUsuarios],
  // Equipes mostram a foto dos membros.
  exports: [UsuariosRepository, FotosUsuarios],
})
export class UsuariosModule {}
