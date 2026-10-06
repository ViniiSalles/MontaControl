import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { BucketPrivadoGateway } from './bucket-privado.gateway';
import { SUPABASE_CLIENT } from './supabase-client.token';

/**
 * Bucket das fotos de atestado. Privado e separado do de avarias: é o que
 * mantém a foto de atestado fora do alcance de quem não é RH (LGPD, N8T2).
 */
@Injectable()
export class SupabaseStorageGateway extends BucketPrivadoGateway {
  constructor(@Inject(SUPABASE_CLIENT) cliente: SupabaseClient, config: ConfigService) {
    super(cliente, config.getOrThrow<string>('SUPABASE_BUCKET_ATESTADOS'));
  }
}
