import { UnauthorizedException } from '@nestjs/common';

/**
 * 401 de qualquer rota autenticada (`SupabaseJwtGuard`): ausência, expiração,
 * malformação, `kid` desconhecido ou usuário inativo/órfão. Do ponto de vista
 * do app, todos levam à mesma ação — voltar ao Login com aviso de sessão
 * expirada — por isso compartilham o mesmo `codigo` (contrato R12).
 */
export class TokenInvalidoException extends UnauthorizedException {
  readonly codigo = 'TOKEN_EXPIRADO';

  constructor(mensagem = 'Sessão expirada. Faça login novamente.') {
    super(mensagem);
  }
}
