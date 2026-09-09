import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase-client.token';

/**
 * Única classe que conhece o Storage do Supabase. O bucket é privado: nada
 * sai dele por URL pública, só por URL assinada de vida curta — é o que
 * mantém a foto de atestado fora do alcance de quem não é RH (LGPD, N8T2).
 */
@Injectable()
export class SupabaseStorageGateway {
  private readonly bucketAtestados: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly cliente: SupabaseClient,
    config: ConfigService,
  ) {
    this.bucketAtestados = config.getOrThrow<string>('SUPABASE_BUCKET_ATESTADOS');
  }

  /** `false` quando o Storage recusou o upload — o chamador decide se aborta. */
  async enviar(caminho: string, conteudo: Buffer, mimeType: string): Promise<boolean> {
    const { error } = await this.cliente.storage
      .from(this.bucketAtestados)
      .upload(caminho, conteudo, { contentType: mimeType, upsert: false });
    return !error;
  }

  async gerarUrlAssinada(caminho: string, segundos: number): Promise<string | null> {
    const { data, error } = await this.cliente.storage
      .from(this.bucketAtestados)
      .createSignedUrl(caminho, segundos);
    return error || !data ? null : data.signedUrl;
  }

  /** Compensação: usada quando a linha em `atestado_foto` falha depois do upload. */
  async remover(caminho: string): Promise<void> {
    await this.cliente.storage.from(this.bucketAtestados).remove([caminho]);
  }
}
