import { IsBase64, IsIn } from 'class-validator';
import type { FotoBase64 } from '@montacontrol/shared';

/** Foto em base64 no corpo JSON — atestado, avaria e foto de usuário. */
export class FotoBase64Dto implements FotoBase64 {
  @IsBase64()
  conteudoBase64!: string;

  @IsIn(['image/jpeg', 'image/png'])
  mimeType!: 'image/jpeg' | 'image/png';
}
