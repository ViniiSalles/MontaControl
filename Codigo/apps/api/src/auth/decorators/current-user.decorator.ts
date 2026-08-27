import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioAutenticado } from '../usuario-autenticado';

/** Extraída à parte para ser testável sem subir um `ExecutionContext` real via HTTP. */
export const extrairUsuarioAtual = (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
  ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>().user;

export const CurrentUser = createParamDecorator(extrairUsuarioAtual);
