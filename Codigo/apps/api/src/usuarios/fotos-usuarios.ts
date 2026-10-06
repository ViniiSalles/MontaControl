import { BadGatewayException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FotoBase64 } from '@montacontrol/shared';
import { FotosUsuariosStorageGateway } from '../supabase/fotos-usuarios-storage.gateway';
import { FotoUsuarioInvalidaException } from './exceptions/foto-usuario-invalida.exception';

const TAMANHO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;
/** Listagens são abertas e fechadas rápido; 1 h evita foto quebrada numa tela deixada aberta. */
const VALIDADE_URL_ASSINADA_SEGUNDOS = 3600;
const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/**
 * Foto de perfil do usuário: valida, sobe para o bucket privado e troca
 * caminhos por URLs assinadas nas listagens. O caminho cru nunca sai da API.
 */
@Injectable()
export class FotosUsuarios {
  constructor(private readonly storage: FotosUsuariosStorageGateway) {}

  /** Devolve o caminho gravado no bucket. */
  async enviar(foto: FotoBase64): Promise<string> {
    const extensao = EXTENSAO_POR_MIME[foto.mimeType];
    if (!extensao) throw new FotoUsuarioInvalidaException(`tipo ${foto.mimeType} não aceito`);

    const conteudo = Buffer.from(foto.conteudoBase64, 'base64');
    if (conteudo.byteLength === 0) throw new FotoUsuarioInvalidaException('conteúdo vazio ou não é base64');
    if (conteudo.byteLength > TAMANHO_MAXIMO_FOTO_BYTES) {
      throw new FotoUsuarioInvalidaException('acima de 5 MB');
    }

    const caminho = `${randomUUID()}.${extensao}`;
    if (!(await this.storage.enviar(caminho, conteudo, foto.mimeType))) {
      throw new BadGatewayException('Falha ao armazenar a foto');
    }
    return caminho;
  }

  async remover(caminho: string): Promise<void> {
    await this.storage.remover(caminho);
  }

  /** Acrescenta `fotoUrl` a cada item; sem foto (ou falha ao assinar) vira `null`. */
  async comUrls<T extends { fotoPath: string | null }>(
    itens: T[],
  ): Promise<Array<T & { fotoUrl: string | null }>> {
    const caminhos = [...new Set(itens.map((item) => item.fotoPath).filter((c): c is string => !!c))];
    const urls = await this.storage.gerarUrlsAssinadas(caminhos, VALIDADE_URL_ASSINADA_SEGUNDOS);
    return itens.map((item) => ({
      ...item,
      fotoUrl: item.fotoPath ? (urls.get(item.fotoPath) ?? null) : null,
    }));
  }
}
