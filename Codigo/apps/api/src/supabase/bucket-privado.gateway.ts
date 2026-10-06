import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Operações sobre um bucket privado do Storage do Supabase. Nada sai dele por
 * URL pública, só por URL assinada de vida curta. Cada bucket tem sua
 * subclasse injetável — fotos de atestado (LGPD, só RH) e de avaria (gestor)
 * não se misturam.
 */
export abstract class BucketPrivadoGateway {
  protected constructor(
    private readonly cliente: SupabaseClient,
    private readonly bucket: string,
  ) {}

  /** `false` quando o Storage recusou o upload — o chamador decide se aborta. */
  async enviar(caminho: string, conteudo: Buffer, mimeType: string): Promise<boolean> {
    const { error } = await this.cliente.storage
      .from(this.bucket)
      .upload(caminho, conteudo, { contentType: mimeType, upsert: false });
    return !error;
  }

  async gerarUrlAssinada(caminho: string, segundos: number): Promise<string | null> {
    const { data, error } = await this.cliente.storage
      .from(this.bucket)
      .createSignedUrl(caminho, segundos);
    return error || !data ? null : data.signedUrl;
  }

  /** Compensação: usada quando a linha da foto falha depois do upload. */
  async remover(caminho: string): Promise<void> {
    await this.cliente.storage.from(this.bucket).remove([caminho]);
  }
}
