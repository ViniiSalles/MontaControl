import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenInvalidoException } from '../../common/exceptions/token-invalido.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsuarioAutenticado } from '../usuario-autenticado';
import { VerificadorTokenService } from '../verificador-token.service';

interface RequisicaoAutenticavel {
  headers: { authorization?: string };
  user?: UsuarioAutenticado;
}

/**
 * Exige `Authorization: Bearer <jwt>` em toda rota não marcada `@Public()`.
 * A verificação do token (JWKS/ES256 + usuário ativo no banco) fica no
 * `VerificadorTokenService`, compartilhado com o gateway WebSocket.
 */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificador: VerificadorTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ehPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (ehPublica) return true;

    const request = context.switchToHttp().getRequest<RequisicaoAutenticavel>();
    const token = this.extrairToken(request.headers.authorization);
    if (!token) throw new TokenInvalidoException('Token ausente');

    request.user = await this.verificador.verificar(token);
    return true;
  }

  private extrairToken(cabecalho: string | undefined): string | null {
    if (!cabecalho?.startsWith('Bearer ')) return null;
    return cabecalho.slice('Bearer '.length);
  }
}
