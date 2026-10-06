import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAuthGateway } from './supabase-auth.gateway';
import { AvariasStorageGateway } from './avarias-storage.gateway';
import { FotosUsuariosStorageGateway } from './fotos-usuarios-storage.gateway';
import { SupabaseStorageGateway } from './supabase-storage.gateway';
import { SUPABASE_CLIENT, SUPABASE_SESSION_CLIENT } from './supabase-client.token';

@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
          { auth: { autoRefreshToken: false, persistSession: false } },
        ),
    },
    {
      provide: SUPABASE_SESSION_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
          { auth: { autoRefreshToken: false, persistSession: false } },
        ),
    },
    SupabaseAuthGateway,
    SupabaseStorageGateway,
    AvariasStorageGateway,
    FotosUsuariosStorageGateway,
  ],
  exports: [
    SupabaseAuthGateway,
    SupabaseStorageGateway,
    AvariasStorageGateway,
    FotosUsuariosStorageGateway,
  ],
})
export class SupabaseModule {}
