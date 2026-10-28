import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey } from 'jose';
import { TokenInvalidoException } from '../common/exceptions/token-invalido.exception';
import { UsuariosRepository } from '../usuarios/usuarios.repository';
import { UsuarioAutenticado } from './usuario-autenticado';

/**
 * Verifica o JWT emitido pelo GoTrue (ES256 via JWKS) e recarrega o usuário
 * do banco por `authUserId` — desativar alguém em `usuario.ativo` surte
 * efeito imediato, em vez de só quando o token expira. Compartilhado pelo
 * `SupabaseJwtGuard` (HTTP) e pelo handshake do gateway WebSocket.
 */
@Injectable()
export class VerificadorTokenService {
  private readonly issuer: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(
    config: ConfigService,
    private readonly usuarios: UsuariosRepository,
  ) {
    this.issuer = config.getOrThrow<string>('SUPABASE_JWT_ISSUER');
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  /** Lança `TokenInvalidoException` se o token for inválido/expirado ou o usuário não existir/estiver inativo. */
  async verificar(token: string): Promise<UsuarioAutenticado> {
    const payload = await this.verificarAssinatura(token);
    if (!payload.sub) throw new TokenInvalidoException('Token sem identificador de usuário');

    const usuario = await this.usuarios.buscarPorAuthUserId(payload.sub);
    if (!usuario || !usuario.ativo) {
      throw new TokenInvalidoException('Usuário inválido ou inativo');
    }
    return usuario;
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
