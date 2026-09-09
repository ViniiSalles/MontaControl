import { ConflictException } from '@nestjs/common';

/** Inativar a própria conta derrubaria a sessão de quem está operando a tela. */
export class InativacaoDoProprioUsuarioException extends ConflictException {
  constructor() {
    super('Não é possível inativar o próprio usuário');
  }
}
