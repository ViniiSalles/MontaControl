import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { BucketPrivadoGateway } from './bucket-privado.gateway';
import { SUPABASE_CLIENT } from './supabase-client.token';

/** Bucket privado das fotos de avaria — só o gestor as vê, por URL assinada. */
@Injectable()
export class AvariasStorageGateway extends BucketPrivadoGateway {
  constructor(@Inject(SUPABASE_CLIENT) cliente: SupabaseClient, config: ConfigService) {
    super(cliente, config.getOrThrow<string>('SUPABASE_BUCKET_AVARIAS'));
  }
}
