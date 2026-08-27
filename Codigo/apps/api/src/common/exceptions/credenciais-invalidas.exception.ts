import { UnauthorizedException } from '@nestjs/common';

/**
 * 401 de `/auth/login`. Precisa ser discriminável de `TokenInvalidoException`
 * no corpo da resposta — senão o app mostra "sessão expirada" para uma senha
 * digitada errada (N1T2 x TI02, ver plano da Sprint 1, contrato R12).
 */
export class CredenciaisInvalidasException extends UnauthorizedException {
  readonly codigo = 'CREDENCIAIS_INVALIDAS';

  constructor() {
    super('Credenciais inválidas');
  }
}
