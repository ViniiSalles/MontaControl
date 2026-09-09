import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAuthGateway } from './supabase-auth.gateway';
import { SupabaseStorageGateway } from './supabase-storage.gateway';
import { SUPABASE_CLIENT } from './supabase-client.token';

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
    SupabaseAuthGateway,
    SupabaseStorageGateway,
  ],
  exports: [SupabaseAuthGateway, SupabaseStorageGateway],
})
export class SupabaseModule {}
