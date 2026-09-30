import { ConflictException } from '@nestjs/common';

/** A peça já recebeu código de barras; reassociar exigiria um fluxo de correção à parte. */
export class PecaJaTriadaException extends ConflictException {
  constructor() {
    super('Esta peça já foi triada');
  }
}
