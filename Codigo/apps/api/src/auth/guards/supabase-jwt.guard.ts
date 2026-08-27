import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey } from 'jose';
import { UsuariosRepository } from '../../usuarios/usuarios.repository';
import { TokenInvalidoException } from '../../common/exceptions/token-invalido.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UsuarioAutenticado } from '../usuario-autenticado';

interface RequisicaoAutenticavel {
  headers: { authorization?: string };
  user?: UsuarioAutenticado;
}

/**
 * Verifica o JWT emitido pelo GoTrue (ES256 via JWKS) e recarrega o usuário
 * do banco por `authUserId` — desativar alguém em `usuario.ativo` surte
 * efeito imediato, em vez de só quando o token expira.
 */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly issuer: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
    private readonly usuarios: UsuariosRepository,
  ) {
    this.issuer = config.getOrThrow<string>('SUPABASE_JWT_ISSUER');
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ehPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (ehPublica) return true;

    const request = context.switchToHttp().getRequest<RequisicaoAutenticavel>();
    const token = this.extrairToken(request.headers.authorization);
    if (!token) throw new TokenInvalidoException('Token ausente');

    const payload = await this.verificarAssinatura(token);
    if (!payload.sub) throw new TokenInvalidoException('Token sem identificador de usuário');

    const usuario = await this.usuarios.buscarPorAuthUserId(payload.sub);
    if (!usuario || !usuario.ativo) {
      throw new TokenInvalidoException('Usuário inválido ou inativo');
    }

    request.user = usuario;
    return true;
  }

  private extrairToken(cabecalho: string | undefined): string | null {
    if (!cabecalho?.startsWith('Bearer ')) return null;
    return cabecalho.slice('Bearer '.length);
  }

  private async verificarAssinatura(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256'],
      });
      return payload;
    } catch {
      throw new TokenInvalidoException('Token inválido ou expirado');
    }
  }
}
