import type { FotoBase64 } from '@montacontrol/shared'

/** Mesmo teto por foto que a API valida. */
export const TAMANHO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024
export const TIPOS_FOTO_ACEITOS = 'image/jpeg,image/png'

/** Mensagem do problema, ou `null` quando o arquivo pode ser enviado. */
export function validarArquivoFoto(arquivo: { type: string; size: number }): string | null {
  if (arquivo.type !== 'image/jpeg' && arquivo.type !== 'image/png') return 'Use uma foto JPG ou PNG.'
  if (arquivo.size > TAMANHO_MAXIMO_FOTO_BYTES) return 'A foto pode ter no máximo 5 MB.'
  return null
}

/** Lê o arquivo do `<input type="file">` no formato que a API aceita. */
export function lerFotoComoBase64(arquivo: File): Promise<FotoBase64> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      const dataUrl = String(leitor.result)
      resolver({
        conteudoBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
        mimeType: arquivo.type as FotoBase64['mimeType'],
      })
    }
    leitor.onerror = () => rejeitar(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}
