import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil } from '../../../generated/prisma';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UsuarioAutenticado } from '../usuario-autenticado';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!perfis || perfis.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>();
    if (!user || !perfis.includes(user.perfil)) {
      throw new ForbiddenException('Acesso negado para o perfil atual');
    }
    return true;
  }
}
