import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { BucketPrivadoGateway } from './bucket-privado.gateway';
import { SUPABASE_CLIENT } from './supabase-client.token';

/** Bucket privado das fotos de usuário — separado de atestados e avarias. */
@Injectable()
export class FotosUsuariosStorageGateway extends BucketPrivadoGateway {
  constructor(@Inject(SUPABASE_CLIENT) cliente: SupabaseClient, config: ConfigService) {
    super(cliente, config.getOrThrow<string>('SUPABASE_BUCKET_FOTOS_USUARIOS'));
  }
}
