import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [SupabaseModule],
  controllers: [UsuariosController],
  providers: [UsuariosRepository, UsuariosService],
  exports: [UsuariosRepository],
})
export class UsuariosModule {}
