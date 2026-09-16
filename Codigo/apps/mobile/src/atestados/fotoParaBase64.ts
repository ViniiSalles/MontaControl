import type { FotoBase64 } from '@montacontrol/shared';

interface AssetDoPicker {
  base64?: string | null;
  mimeType?: string;
}

/**
 * `expo-image-picker` já devolve `base64` e `mimeType`; só falta moldar pro
 * formato que a API aceita. `null` quando falta algo que o backend exige
 * (ex.: picker sem `base64: true`, ou formato fora de JPEG/PNG — como HEIC).
 */
export function paraFotoBase64(asset: AssetDoPicker): FotoBase64 | null {
  if (!asset.base64) return null;
  if (asset.mimeType !== 'image/jpeg' && asset.mimeType !== 'image/png') return null;
  return { conteudoBase64: asset.base64, mimeType: asset.mimeType };
}
